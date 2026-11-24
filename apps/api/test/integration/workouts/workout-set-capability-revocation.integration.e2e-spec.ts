import { randomUUID } from 'node:crypto';

import { ForbiddenException, NotFoundException, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { WorkoutsRepository } from '../../../src/modules/workouts/repositories/workouts.repository.js';
import { WorkoutsService } from '../../../src/modules/workouts/services/workouts.service.js';
import { UsersRepository } from '../../../src/modules/users/repositories/users.repository.js';
import { UsersService } from '../../../src/modules/users/services/users.service.js';
import { assertWorkoutAthlete } from '../../../src/modules/workouts/policies/workout-access.policy.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Workout set write authorization races (PostgreSQL)', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let workouts: WorkoutsService;
  let workoutRepository: WorkoutsRepository;
  let users: UsersService;
  let usersRepository: UsersRepository;
  const suffix = randomUUID();
  let athleteId = '';
  let exerciseId = '';
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
    workoutRepository = app.get(WorkoutsRepository);
    users = app.get(UsersService);
    usersRepository = app.get(UsersRepository);

    const athlete = await prisma.user.create({
      data: {
        email: `workout-set-race-${suffix}@example.test`,
        passwordHash: 'fixture-hash',
        role: 'ATHLETE',
      },
      select: { id: true },
    });
    athleteId = athlete.id;

    const exercise = await prisma.exercise.create({
      data: { name: `Set race fixture ${suffix}`, source: 'GLOBAL' },
      select: { id: true },
    });
    exerciseId = exercise.id;
  }, 20_000);

  afterAll(async () => {
    try {
      if (!prisma) return;
      if (workoutIds.length > 0) {
        await prisma.workout.deleteMany({ where: { id: { in: workoutIds } } });
      }
      if (exerciseId) await prisma.exercise.delete({ where: { id: exerciseId } });
      if (athleteId) await prisma.user.delete({ where: { id: athleteId } });
    } finally {
      await app?.close();
    }
  }, 20_000);

  async function createInProgressWorkout() {
    const workout = await prisma.workout.create({
      data: {
        title: `Set race ${randomUUID()}`,
        athleteId,
        createdById: athleteId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        exercises: {
          create: [
            {
              exerciseId,
              exerciseNameSnapshot: 'Set fixture',
              exerciseTypeSnapshot: 'STRENGTH',
              sortOrder: 0,
              sets: { create: [{ setNumber: 1, plannedReps: 10 }] },
            },
          ],
        },
      },
      select: {
        id: true,
        exercises: { select: { sets: { select: { id: true } } } },
      },
    });
    workoutIds.push(workout.id);
    return { workoutId: workout.id, setId: workout.exercises[0]!.sets[0]!.id };
  }

  it.each(['promotion', 'suspension'] as const)(
    'denies a stale Athlete set update after %s commits before the locked write',
    async (moderationKind) => {
      await prisma.user.update({
        where: { id: athleteId },
        data: { role: 'ATHLETE', status: 'ACTIVE' },
      });
      const { workoutId, setId } = await createInProgressWorkout();

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
        expect((await users.findMyCapabilities(athleteId)).athlete).toBe(true);

        pending = workouts
          .updateSet(
            workoutId,
            setId,
            { id: athleteId, role: 'ATHLETE' },
            { status: 'COMPLETED', actualReps: 9 },
          )
          .then(
            () => 'UNEXPECTED_WRITE',
            (error: unknown) => error,
          );

        // The write must wait for the moderation transaction to commit.
        await attempted;
        releaseLock();
        await moderation;
        await expect(pending).resolves.toBeInstanceOf(
          moderationKind === 'promotion' ? ForbiddenException : NotFoundException,
        );
        const persisted = await prisma.workoutSet.findUniqueOrThrow({
          where: { id: setId },
          select: { status: true, actualReps: true },
        });
        expect(persisted).toEqual({ status: 'PENDING', actualReps: null });
      } finally {
        releaseLock();
        spy.mockRestore();
        await moderation;
        if (pending) await pending;
      }
    },
    20_000,
  );

  it('refuses writes when the set does not belong to the workout and athlete scope', async () => {
    await prisma.user.update({
      where: { id: athleteId },
      data: { role: 'ATHLETE', status: 'ACTIVE' },
    });
    const { workoutId, setId } = await createInProgressWorkout();
    for (const scope of [
      { workoutId: randomUUID(), athleteId },
      { workoutId, athleteId: randomUUID() },
    ]) {
      await expect(
        workoutRepository.updateSet(
          setId,
          { status: 'COMPLETED', completedAt: new Date() },
          { ...scope, authorize: async () => {} },
        ),
      ).resolves.toBeNull();
    }
    expect(
      await prisma.workoutSet.findUniqueOrThrow({
        where: { id: setId },
        select: { status: true },
      }),
    ).toEqual({ status: 'PENDING' });
  });

  it('refuses a direct write after the caller is no longer an Athlete', async () => {
    await prisma.user.update({
      where: { id: athleteId },
      data: { role: 'ADMIN', status: 'ACTIVE' },
    });
    const { workoutId, setId } = await createInProgressWorkout();
    await expect(
      workoutRepository.updateSet(
        setId,
        { status: 'COMPLETED', completedAt: new Date() },
        {
          workoutId,
          athleteId,
          authorize: async (tx) => {
            assertWorkoutAthlete(await users.findMyCapabilitiesForWrite(tx, athleteId));
          },
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
