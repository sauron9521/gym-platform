import { randomUUID } from 'node:crypto';

import { ForbiddenException, NotFoundException, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { WorkoutsService } from '../../../src/modules/workouts/services/workouts.service.js';
import { UsersRepository } from '../../../src/modules/users/repositories/users.repository.js';
import { UsersService } from '../../../src/modules/users/services/users.service.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Manual workout creation permission revocation (PostgreSQL)', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let workouts: WorkoutsService;
  let users: UsersService;
  let usersRepository: UsersRepository;
  const suffix = randomUUID();
  let athleteId = '';
  let exerciseId = '';

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
        email: `workout-create-revocation-${suffix}@example.test`,
        passwordHash: 'fixture-hash',
        role: 'ATHLETE',
      },
      select: { id: true },
    });
    athleteId = athlete.id;

    const exercise = await prisma.exercise.create({
      data: {
        name: `Workout creation source ${suffix}`,
        source: 'GLOBAL',
        exerciseType: 'STRENGTH',
      },
      select: { id: true },
    });
    exerciseId = exercise.id;
  }, 20_000);

  afterAll(async () => {
    try {
      if (!prisma) return;
      if (athleteId) {
        await prisma.workout.deleteMany({ where: { athleteId } });
      }
      if (exerciseId) {
        await prisma.exercise.deleteMany({ where: { id: exerciseId } });
      }
      if (athleteId) {
        await prisma.user.deleteMany({ where: { id: athleteId } });
      }
    } finally {
      await app?.close();
    }
  }, 20_000);

  const input = () => ({
    title: `Forbidden after moderation ${suffix}`,
    exercises: [{ exerciseId, sets: [{ plannedReps: 8 }] }],
  });

  it.each(['promotion', 'suspension'] as const)(
    'denies a stale Athlete manual creation if account %s commits first',
    async (moderationKind) => {
      await prisma.user.update({
        where: { id: athleteId },
        data: { role: 'ATHLETE', status: 'ACTIVE' },
      });

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
        await tx.user.update({
          where: { id: athleteId },
          data: moderationKind === 'promotion' ? { role: 'ADMIN' } : { status: 'SUSPENDED' },
        });
        markHeld();
        await release;
      });

      let pending: Promise<unknown> | undefined;
      try {
        await held;
        // The ordinary service preflight still observes the committed Athlete.
        expect((await users.findMyCapabilities(athleteId)).athlete).toBe(true);

        pending = workouts.create({ id: athleteId, role: 'ATHLETE' }, input()).then(
          () => 'UNEXPECTED_CREATE',
          (error: unknown) => error,
        );

        // The final permission check waits for the uncommitted User update.
        await attempted;
        releaseLock();
        await moderation;

        await expect(pending).resolves.toBeInstanceOf(
          moderationKind === 'promotion' ? ForbiddenException : NotFoundException,
        );
        expect(
          await prisma.workout.count({
            where: { athleteId, title: input().title },
          }),
        ).toBe(0);
      } finally {
        releaseLock();
        spy.mockRestore();
        await moderation;
        if (pending) await pending;
      }
    },
    20_000,
  );

  it('permits a new workout when the current Athlete capability remains active', async () => {
    await prisma.user.update({
      where: { id: athleteId },
      data: { role: 'ATHLETE', status: 'ACTIVE' },
    });
    const created = await workouts.create(
      { id: athleteId, role: 'ATHLETE' },
      { ...input(), title: `Allowed manual workout ${suffix}` },
    );
    expect(created.athleteId).toBe(athleteId);
    expect(created.status).toBe('PLANNED');
  });
});
