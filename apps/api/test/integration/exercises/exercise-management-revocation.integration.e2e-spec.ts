import { randomUUID } from 'node:crypto';

import { ForbiddenException, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { ExercisesService } from '../../../src/modules/exercises/services/exercises.service.js';
import { UsersRepository } from '../../../src/modules/users/repositories/users.repository.js';
import { UsersService } from '../../../src/modules/users/services/users.service.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Exercise management revocation races (PostgreSQL)', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let exercises: ExercisesService;
  let users: UsersService;
  let usersRepository: UsersRepository;
  const suffix = randomUUID();
  let adminId = '';
  const exerciseIds: string[] = [];

  beforeAll(async () => {
    useTestDatabase();
    const moduleRef = await Test.createTestingModule({
      imports: [await ConfigModule.forRoot({ isGlobal: true }), AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    exercises = app.get(ExercisesService);
    users = app.get(UsersService);
    usersRepository = app.get(UsersRepository);

    const user = await prisma.user.create({
      data: {
        email: `exercise-management-lock-${suffix}@example.test`,
        passwordHash: 'fixture-hash',
        role: 'ADMIN',
      },
      select: { id: true },
    });
    adminId = user.id;
  }, 20_000);

  afterAll(async () => {
    try {
      if (!prisma) return;
      if (exerciseIds.length > 0) {
        await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
      }
      if (adminId) {
        await prisma.user.deleteMany({ where: { id: adminId } });
      }
    } finally {
      await app?.close();
    }
  }, 20_000);

  it.each(['update', 'archive'] as const)(
    'blocks a stale Admin %s while concurrent moderation commits demotion',
    async (operation) => {
      await prisma.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });
      const initialName = `Global ${operation} ${suffix}`;
      const exercise = await prisma.exercise.create({
        data: { name: initialName, source: 'GLOBAL', exerciseType: 'STRENGTH' },
        select: { id: true },
      });
      exerciseIds.push(exercise.id);

      let markHeld!: () => void;
      const held = new Promise<void>((resolve) => {
        markHeld = resolve;
      });
      let releaseLock!: () => void;
      const release = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      let markWriteAttempt!: () => void;
      const attempted = new Promise<void>((resolve) => {
        markWriteAttempt = resolve;
      });

      const original = usersRepository.findCapabilitySnapshotForWrite.bind(usersRepository);
      const spy = vi.spyOn(usersRepository, 'findCapabilitySnapshotForWrite');
      spy.mockImplementation(async (tx, id) => {
        if (id === adminId) markWriteAttempt();
        return original(tx, id);
      });

      const moderation = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id" FROM "users" WHERE "id" = ${adminId} FOR UPDATE
        `;
        await tx.user.update({ where: { id: adminId }, data: { role: 'ATHLETE' } });
        markHeld();
        await release;
      });

      let pending: Promise<unknown> | undefined;
      try {
        await held;
        // READ COMMITTED still exposes Admin status until moderation commits.
        expect((await users.findMyCapabilities(adminId)).admin).toBe(true);

        const actor = { id: adminId, role: 'ADMIN' as const };
        pending = (
          operation === 'update'
            ? exercises.update(exercise.id, actor, { name: 'FORBIDDEN UPDATE' })
            : exercises.archive(exercise.id, actor)
        ).then(
          () => 'UNEXPECTED_WRITE',
          (error: unknown) => error,
        );

        // The final account lock must wait behind the uncommitted demotion.
        await attempted;
        releaseLock();
        await moderation;

        await expect(pending).resolves.toBeInstanceOf(ForbiddenException);
        const actual = await prisma.exercise.findUniqueOrThrow({
          where: { id: exercise.id },
          select: { name: true, isArchived: true },
        });
        expect(actual).toEqual({ name: initialName, isArchived: false });
      } finally {
        releaseLock();
        spy.mockRestore();
        await moderation;
        if (pending) await pending;
      }
    },
    20_000,
  );
});
