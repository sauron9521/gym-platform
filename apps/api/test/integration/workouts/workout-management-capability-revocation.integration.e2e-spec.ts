import { randomUUID } from 'node:crypto';

import { ForbiddenException, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { WorkoutsService } from '../../../src/modules/workouts/services/workouts.service.js';
import { UsersRepository } from '../../../src/modules/users/repositories/users.repository.js';
import { UsersService } from '../../../src/modules/users/services/users.service.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Workout management capability revocation (PostgreSQL)', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let workouts: WorkoutsService;
  let users: UsersService;
  let usersRepository: UsersRepository;
  const suffix = randomUUID();
  let athleteId = '';
  const workoutIds: string[] = [];

  beforeAll(async () => {
    useTestDatabase();
    const moduleRef = await Test.createTestingModule({
      imports: [await ConfigModule.forRoot({ isGlobal: true }), AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    workouts = app.get(WorkoutsService);
    users = app.get(UsersService);
    usersRepository = app.get(UsersRepository);

    const athlete = await prisma.user.create({
      data: {
        email: `workout-management-lock-${suffix}@example.test`,
        passwordHash: 'fixture-hash',
        role: 'ATHLETE',
      },
      select: { id: true },
    });
    athleteId = athlete.id;
  }, 20_000);

  afterAll(async () => {
    try {
      if (!prisma) return;
      if (workoutIds.length > 0) {
        await prisma.workout.deleteMany({ where: { id: { in: workoutIds } } });
      }
      if (athleteId) {
        await prisma.user.deleteMany({ where: { id: athleteId } });
      }
    } finally {
      await app?.close();
    }
  }, 20_000);

  it.each(['edit', 'cancel'] as const)(
    'denies a stale Athlete %s when promotion commits before the locked write',
    async (operation) => {
      await prisma.user.update({ where: { id: athleteId }, data: { role: 'ATHLETE' } });
      const initialTitle = `Workout ${operation} ${suffix}`;
      const workout = await prisma.workout.create({
        data: { title: initialTitle, athleteId, createdById: athleteId },
        select: { id: true },
      });
      workoutIds.push(workout.id);

      let markHeld!: () => void;
      const held = new Promise<void>((resolve) => {
        markHeld = resolve;
      });
      let releaseLock!: () => void;
      const release = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      let markAttempted!: () => void;
      const attempted = new Promise<void>((resolve) => {
        markAttempted = resolve;
      });

      const original = usersRepository.findCapabilitySnapshotForWrite.bind(usersRepository);
      const spy = vi.spyOn(usersRepository, 'findCapabilitySnapshotForWrite');
      spy.mockImplementation(async (tx, id) => {
        if (id === athleteId) markAttempted();
        return original(tx, id);
      });

      const moderation = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id" FROM "users" WHERE "id" = ${athleteId} FOR UPDATE
        `;
        await tx.user.update({ where: { id: athleteId }, data: { role: 'ADMIN' } });
        markHeld();
        await release;
      });

      let pending: Promise<unknown> | undefined;
      try {
        await held;
        // Before moderation commits, an ordinary preflight still sees Athlete.
        expect((await users.findMyCapabilities(athleteId)).athlete).toBe(true);

        const actor = { id: athleteId, role: 'ATHLETE' as const };
        pending = (
          operation === 'edit'
            ? workouts.update(workout.id, actor, { title: 'MUST NOT WRITE' })
            : workouts.cancel(workout.id, actor)
        ).then(
          () => 'UNEXPECTED_WRITE',
          (error: unknown) => error,
        );

        // The final User row lock must wait behind the uncommitted promotion.
        await attempted;
        releaseLock();
        await moderation;
        await expect(pending).resolves.toBeInstanceOf(ForbiddenException);
        expect(
          await prisma.workout.findUniqueOrThrow({
            where: { id: workout.id },
            select: { title: true, status: true },
          }),
        ).toEqual({ title: initialTitle, status: 'PLANNED' });
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
