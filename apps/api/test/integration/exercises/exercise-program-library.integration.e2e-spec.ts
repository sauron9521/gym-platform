import { randomUUID } from 'node:crypto';

import { ForbiddenException, NotFoundException, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { TrainingProgramExerciseService } from '../../../src/modules/training-programs/services/training-program-exercise.service.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Training program exercise eligibility (PostgreSQL + Nest services)', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let programExercises: TrainingProgramExerciseService;

  const userIds: string[] = [];
  const exerciseIds: string[] = [];
  let programId = '';

  beforeAll(async () => {
    useTestDatabase();

    const moduleRef = await Test.createTestingModule({
      imports: [await ConfigModule.forRoot({ isGlobal: true }), AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    programExercises = app.get(TrainingProgramExerciseService);
  }, 20_000);

  afterAll(async () => {
    try {
      if (!prisma) return;
      if (programId) {
        await prisma.trainingProgramVersion.deleteMany({ where: { programId } });
        await prisma.trainingProgram.delete({ where: { id: programId } });
      }
      if (exerciseIds.length > 0) {
        await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
      }
      if (userIds.length > 0) {
        await prisma.trainerProfile.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      await app?.close();
    }
  }, 20_000);

  it('accepts approved ATHLETE-role trainers and rejects revoked or foreign exercise access', async () => {
    const suffix = randomUUID();
    const trainer = await prisma.user.create({
      data: {
        email: `exercise-program-trainer-${suffix}@example.test`,
        passwordHash: 'fixture-hash',
        role: 'ATHLETE',
      },
      select: { id: true },
    });
    userIds.push(trainer.id);

    const outsider = await prisma.user.create({
      data: {
        email: `exercise-program-outsider-${suffix}@example.test`,
        passwordHash: 'fixture-hash',
        role: 'ATHLETE',
      },
      select: { id: true },
    });
    userIds.push(outsider.id);

    await prisma.trainerProfile.create({
      data: {
        userId: trainer.id,
        isActive: true,
        approvedAt: new Date(),
        approvedById: trainer.id,
      },
    });

    const program = await prisma.trainingProgram.create({
      data: { trainerId: trainer.id, status: 'DRAFT' },
      select: { id: true },
    });
    programId = program.id;
    const version = await prisma.trainingProgramVersion.create({
      data: {
        programId,
        version: 1,
        title: 'Trainer capability regression',
        status: 'DRAFT',
        durationWeeks: 1,
      },
      select: { id: true },
    });
    const workout = await prisma.trainingProgramWorkout.create({
      data: {
        versionId: version.id,
        weekNumber: 1,
        dayNumber: 1,
        title: 'Training day',
      },
      select: { id: true },
    });

    async function createExercise(
      source: 'GLOBAL' | 'TRAINER_CUSTOM' | 'ATHLETE_CUSTOM',
      ownerId?: string,
    ) {
      const exercise = await prisma.exercise.create({
        data: {
          name: `Library eligibility ${randomUUID()}`,
          source,
          exerciseType: 'STRENGTH',
          ...(ownerId ? { createdById: ownerId } : {}),
          ...(source === 'ATHLETE_CUSTOM' ? { visibility: 'PRIVATE' as const } : {}),
        },
        select: { id: true },
      });
      exerciseIds.push(exercise.id);
      return exercise.id;
    }

    const ownTrainer = await createExercise('TRAINER_CUSTOM', trainer.id);
    const global = await createExercise('GLOBAL');
    const foreign = await createExercise('TRAINER_CUSTOM', outsider.id);
    const privateAthlete = await createExercise('ATHLETE_CUSTOM', trainer.id);
    const actor = { id: trainer.id, role: 'ATHLETE' as const };

    await programExercises.addExercise(actor, programId, version.id, workout.id, {
      exerciseId: ownTrainer,
    });
    await programExercises.addExercise(actor, programId, version.id, workout.id, {
      exerciseId: global,
    });

    expect(
      await prisma.trainingProgramExercise.findMany({
        where: { workoutId: workout.id },
        select: { exerciseId: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ).toEqual([{ exerciseId: ownTrainer }, { exerciseId: global }]);

    for (const exerciseId of [foreign, privateAthlete]) {
      await expect(
        programExercises.addExercise(actor, programId, version.id, workout.id, { exerciseId }),
      ).rejects.toThrow(NotFoundException);
    }

    await prisma.trainerProfile.update({
      where: { userId: trainer.id },
      data: { isActive: false, revokedAt: new Date(), revokedById: trainer.id },
    });

    for (const exerciseId of [global, ownTrainer]) {
      await expect(
        programExercises.addExercise(actor, programId, version.id, workout.id, { exerciseId }),
      ).rejects.toThrow(ForbiddenException);
    }

    expect(await prisma.trainingProgramExercise.count({ where: { workoutId: workout.id } })).toBe(
      2,
    );
  });
});
