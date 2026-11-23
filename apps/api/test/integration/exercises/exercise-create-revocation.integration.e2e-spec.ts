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

describe('Exercise creation revocation race (PostgreSQL)', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let exercises: ExercisesService;
  let users: UsersService;
  let usersRepository: UsersRepository;
  const suffix = randomUUID();
  let userId = '';
  let muscleSlug = '';

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
        email: `exercise-create-lock-${suffix}@example.test`,
        passwordHash: 'fixture-hash',
        role: 'ATHLETE',
      },
      select: { id: true },
    });
    userId = user.id;

    await prisma.trainerProfile.create({
      data: {
        userId,
        isActive: true,
        approvedAt: new Date(),
        approvedById: userId,
      },
    });

    muscleSlug = `atomic-${suffix}`;
    await prisma.muscleGroup.create({
      data: { slug: muscleSlug, name: `Atomic test ${suffix}` },
    });
  }, 20_000);

  afterAll(async () => {
    try {
      if (!prisma) return;
      if (userId) {
        await prisma.exercise.deleteMany({ where: { createdById: userId } });
        await prisma.trainerProfile.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { id: userId } });
      }
      if (muscleSlug) {
        await prisma.muscleGroup.deleteMany({ where: { slug: muscleSlug } });
      }
    } finally {
      await app?.close();
    }
  }, 20_000);

  it('blocks stale Trainer creation while moderation revokes the grant', async () => {
    const name = `Forbidden Trainer exercise ${suffix}`;
    const actor = { id: userId, role: 'ATHLETE' as const };
    const input = {
      name,
      creationScope: 'TRAINER' as const,
      muscleGroups: [{ slug: muscleSlug, role: 'PRIMARY' as const }],
      equipment: [],
    };

    let markHeld!: () => void;
    const held = new Promise<void>((resolve) => {
      markHeld = resolve;
    });
    let releaseLock!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    let markWriteAttempt!: () => void;
    const writeAttempt = new Promise<void>((resolve) => {
      markWriteAttempt = resolve;
    });

    const original = usersRepository.findCapabilitySnapshotForWrite.bind(usersRepository);
    const spy = vi.spyOn(usersRepository, 'findCapabilitySnapshotForWrite').mockImplementation(
      async (tx, id) => {
        if (id === userId) markWriteAttempt();
        return original(tx, id);
      },
    );

    const moderation = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE
      `;
      await tx.trainerProfile.update({
        where: { userId },
        data: { isActive: false, revokedAt: new Date(), revokedById: userId },
      });
      markHeld();
      await release;
    });

    try {
      await held;
      // READ COMMITTED still exposes the approved state until moderation commits.
      expect((await users.findMyCapabilities(userId)).trainer).toBe(true);

      const pending = exercises.create(actor, input).then(
        () => 'UNEXPECTED_WRITE',
        (error: unknown) => error,
      );
      // The repository has entered the *locked* checkpoint and must wait
      // for the moderation transaction before it can perform the INSERT.
      await writeAttempt;
      releaseLock();
      await moderation;

      await expect(pending).resolves.toBeInstanceOf(ForbiddenException);
      expect(await prisma.exercise.count({ where: { createdById: userId, name } })).toBe(0);
    } finally {
      releaseLock();
      spy.mockRestore();
      await moderation;
    }
  }, 20_000);
});
