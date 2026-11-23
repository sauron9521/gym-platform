import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '#prisma/client';

import { ExercisesService } from '#src/modules/exercises/services/exercises.service';
import { UsersService } from '#src/modules/users/services/users.service';
import { WorkoutsRepository } from '../repositories/workouts.repository.js';
import { WorkoutsService } from '../services/workouts.service.js';
import { workoutIdempotency } from '../utils/workout-idempotency.js';

import type {
  CreateWorkoutFromProgramInput,
  CreateWorkoutInput,
  WorkoutActor,
} from '../types/workout.types.js';
import { TrainerAthletesService } from '#src/modules/trainer-athletes/services/trainer-athletes.service';

describe('WorkoutsService', () => {
  let service: WorkoutsService;

  const repository = {
    create: vi.fn(),
    createFromProgram: vi.fn(),
    findByIdempotencyKey: vi.fn(),
    findMany: vi.fn(),
    findManySummary: vi.fn(),
    findById: vi.fn(),
    findCompletedExport: vi.fn(),
    update: vi.fn(),
    updateSet: vi.fn(),
    completeWorkout: vi.fn(),
    startWorkout: vi.fn(),
  };

  const exercisesService = {
    findAvailableForWorkout: vi.fn(),
  };

  const athlete: WorkoutActor = {
    id: 'athlete-1',
    role: 'ATHLETE',
  };

  const trainer: WorkoutActor = {
    id: 'trainer-1',
    role: 'TRAINER',
  };
  const staleAdmin: WorkoutActor = { id: 'admin-1', role: 'ATHLETE' };
  const usersService = {
    findMyCapabilities: vi.fn(),
    findMyCapabilitiesForWrite: vi.fn(),
  };

  const availableExercise = {
    id: 'exercise-1',
    name: 'Bench Press',
    exerciseType: 'STRENGTH',
  };

  const createInput: CreateWorkoutInput = {
    title: 'Upper Body',
    notes: 'Push workout',
    exercises: [
      {
        exerciseId: 'exercise-1',
        sets: [
          {
            plannedReps: 10,
            plannedWeightKg: 60,
            restSeconds: 90,
            targetRpe: 8,
            targetRir: 2,
          },
          {
            plannedReps: 8,
            plannedWeightKg: 60,
            restSeconds: 90,
            targetRpe: 8,
            targetRir: 2,
          },
        ],
      },
    ],
  };

  const plannedWorkout = {
    id: 'workout-1',
    title: 'Upper Body',
    athleteId: athlete.id,
    createdById: athlete.id,
    status: 'PLANNED',
    exercises: [
      {
        id: 'workout-exercise-1',
        exerciseId: 'exercise-1',
        exerciseNameSnapshot: 'Bench Press',
        sets: [
          {
            id: 'set-1',
            setNumber: 1,
            status: 'PENDING',
            plannedReps: 10,
            plannedWeightKg: 60,
          },
          {
            id: 'set-2',
            setNumber: 2,
            status: 'PENDING',
            plannedReps: 8,
            plannedWeightKg: 60,
          },
        ],
      },
    ],
  };

  const trainerAthletesService = {
    getExerciseAccessContext: vi.fn(),
  };

  const exerciseAccess = {
    activeTrainerIds: [],
    activeAthleteIds: [],
  };

  beforeEach(() => {
    vi.resetAllMocks();

    exercisesService.findAvailableForWorkout.mockResolvedValue([availableExercise]);

    trainerAthletesService.getExerciseAccessContext.mockResolvedValue(exerciseAccess);
    usersService.findMyCapabilities.mockImplementation(async (id: string) => ({
      athlete: id !== staleAdmin.id,
      trainer: id === trainer.id,
      admin: id === staleAdmin.id,
    }));
    usersService.findMyCapabilitiesForWrite.mockImplementation(
      async (_tx: unknown, id: string) => ({
        athlete: id !== staleAdmin.id,
        trainer: id === trainer.id,
        admin: id === staleAdmin.id,
      }),
    );

    service = new WorkoutsService(
      repository as unknown as WorkoutsRepository,
      exercisesService as unknown as ExercisesService,
      trainerAthletesService as unknown as TrainerAthletesService,
      usersService as unknown as UsersService,
    );
  });

  it('preserves personal workout list scope for a legacy TRAINER identity', async () => {
    repository.findMany.mockResolvedValue({ data: [], meta: { total: 0 } });

    await service.findMany(trainer, { page: 1, limit: 20 });

    expect(usersService.findMyCapabilities).toHaveBeenCalledWith(trainer.id);
    expect(repository.findMany).toHaveBeenCalledWith({
      where: { athleteId: trainer.id },
      skip: 0,
      take: 20,
    });
  });

  it('denies a promoted admin reusing an old TRAINER session', async () => {
    const oldSession: WorkoutActor = { id: staleAdmin.id, role: 'TRAINER' };
    await expect(service.findMany(oldSession, { page: 1, limit: 20 })).rejects.toThrow(
      ForbiddenException,
    );
    expect(repository.findMany).not.toHaveBeenCalled();
  });

  it('fails closed if the persisted account is deleted or unavailable', async () => {
    usersService.findMyCapabilities.mockRejectedValue(new NotFoundException('User not found'));
    await expect(service.findMany(athlete, { page: 1, limit: 20 })).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.findMany).not.toHaveBeenCalled();
  });

  it('should use active trainer access when creating a workout', async () => {
    const access = {
      activeTrainerIds: ['trainer-1'],
      activeAthleteIds: [],
    };

    trainerAthletesService.getExerciseAccessContext.mockResolvedValue(access);

    repository.create.mockResolvedValue(plannedWorkout);

    await service.create(athlete, createInput);

    expect(trainerAthletesService.getExerciseAccessContext).toHaveBeenCalledWith(athlete);

    expect(exercisesService.findAvailableForWorkout).toHaveBeenCalledWith(
      athlete,
      ['exercise-1'],
      access,
    );
  });

  describe('createFromProgram', () => {
    const input: CreateWorkoutFromProgramInput = {
      assignmentId: 'assignment-1',
      programWorkoutId: 'program-workout-1',
      scheduledAt: new Date('2030-01-15T10:00:00.000Z'),
    };

    const workoutFromProgram = {
      id: 'workout-1',
      title: 'Upper Body',
      athleteId: athlete.id,
      createdById: athlete.id,
      status: 'PLANNED',
      programAssignmentId: input.assignmentId,
      programWorkoutId: input.programWorkoutId,
    };

    it('should create a workout from an assigned program', async () => {
      repository.createFromProgram.mockResolvedValue(workoutFromProgram);

      const result = await service.createFromProgram(athlete, input);

      expect(result).toEqual(workoutFromProgram);

      expect(repository.createFromProgram).toHaveBeenCalledWith({
        athleteId: athlete.id,
        assignmentId: input.assignmentId,
        programWorkoutId: input.programWorkoutId,
        scheduledAt: input.scheduledAt,
      });
    });

    it('rejects admin-promoted accounts even with stale ATHLETE sessions', async () => {
      await expect(service.createFromProgram(staleAdmin, input)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.createFromProgram).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when assignment or workout is unavailable', async () => {
      repository.createFromProgram.mockResolvedValue(null);

      await expect(service.createFromProgram(athlete, input)).rejects.toThrow(NotFoundException);

      expect(repository.createFromProgram).toHaveBeenCalledOnce();
    });
  });

  describe('create', () => {
    it('should create a workout with exercises and planned sets', async () => {
      repository.create.mockResolvedValue(plannedWorkout);

      const result = await service.create(athlete, createInput);

      expect(result).toEqual(plannedWorkout);

      expect(exercisesService.findAvailableForWorkout).toHaveBeenCalledWith(
        athlete,
        ['exercise-1'],
        {
          activeTrainerIds: [],
          activeAthleteIds: [],
        },
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Upper Body',
          notes: 'Push workout',
          athlete: {
            connect: { id: athlete.id },
          },
          createdBy: {
            connect: { id: athlete.id },
          },
          exercises: {
            create: [
              expect.objectContaining({
                exerciseNameSnapshot: 'Bench Press',
                exerciseTypeSnapshot: 'STRENGTH',
                sortOrder: 0,
                sets: {
                  create: [
                    expect.objectContaining({
                      setNumber: 1,
                      plannedReps: 10,
                      plannedWeightKg: 60,
                      targetRpe: 8,
                      targetRir: 2,
                      setType: 'WORKING',
                    }),
                    expect.objectContaining({
                      setNumber: 2,
                      plannedReps: 8,
                      plannedWeightKg: 60,
                    }),
                  ],
                },
              }),
            ],
          },
        }),
        athlete.id,
        ['exercise-1'],
        expect.any(Function),
      );
    });

    it('denies a stale Athlete creation after promotion at the final write checkpoint', async () => {
      repository.create.mockResolvedValue(plannedWorkout);
      await service.create(athlete, createInput);
      const authorize = repository.create.mock.calls[0]?.[3];

      usersService.findMyCapabilitiesForWrite.mockResolvedValue({
        athlete: false,
        trainer: false,
        admin: true,
      });

      await expect(authorize({ id: 'tx' })).rejects.toThrow(ForbiddenException);
      expect(usersService.findMyCapabilitiesForWrite).toHaveBeenCalledWith(
        { id: 'tx' },
        athlete.id,
      );
    });

    it('allows former Trainers to create their own Athlete workouts', async () => {
      repository.create.mockResolvedValue(plannedWorkout);
      await service.create(trainer, createInput);
      const authorize = repository.create.mock.calls[0]?.[3];

      usersService.findMyCapabilitiesForWrite.mockResolvedValue({
        athlete: true,
        trainer: false,
        admin: false,
      });

      await expect(authorize({})).resolves.toBeUndefined();
    });

    it('rejects admin-promoted accounts even with stale ATHLETE sessions', async () => {
      await expect(service.create(staleAdmin, createInput)).rejects.toThrow(ForbiddenException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should reject a workout without exercises', async () => {
      await expect(
        service.create(athlete, {
          ...createInput,
          exercises: [],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should reject an exercise without sets', async () => {
      await expect(
        service.create(athlete, {
          ...createInput,
          exercises: [
            {
              exerciseId: 'exercise-1',
              sets: [],
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should reject unavailable exercises', async () => {
      exercisesService.findAvailableForWorkout.mockRejectedValue(
        new BadRequestException('One or more exercises are not available'),
      );

      await expect(service.create(athlete, createInput)).rejects.toThrow(BadRequestException);

      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findMany', () => {
    it('should return workouts with pagination', async () => {
      const response = {
        data: [plannedWorkout],
        meta: {
          total: 1,
          skip: 0,
          take: 10,
          totalPages: 1,
        },
      };

      repository.findMany.mockResolvedValue(response);

      const result = await service.findMany(athlete, {
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(response);

      expect(repository.findMany).toHaveBeenCalledWith({
        where: {
          athleteId: athlete.id,
        },
        skip: 0,
        take: 10,
      });
    });

    it('should use the summary repository only when explicitly requested', async () => {
      const response = {
        data: [{ id: 'workout-1', title: 'Upper Body', exerciseCount: 1 }],
        meta: { total: 1, skip: 0, take: 10, totalPages: 1 },
      };
      repository.findManySummary.mockResolvedValue(response);

      const result = await service.findMany(athlete, {
        page: 1,
        limit: 10,
        view: 'summary',
      });

      expect(result).toEqual(response);
      expect(repository.findManySummary).toHaveBeenCalledWith({
        where: { athleteId: athlete.id },
        skip: 0,
        take: 10,
      });
      expect(repository.findMany).not.toHaveBeenCalled();
    });

    it('should filter by status and scheduled date', async () => {
      repository.findMany.mockResolvedValue({
        data: [],
        meta: {},
      });

      const scheduledFrom = new Date('2026-11-01T00:00:00.000Z');
      const scheduledTo = new Date('2026-11-30T23:59:59.000Z');

      await service.findMany(athlete, {
        page: 1,
        limit: 20,
        status: 'PLANNED',
        scheduledFrom,
        scheduledTo,
      });

      expect(repository.findMany).toHaveBeenCalledWith({
        where: {
          athleteId: athlete.id,
          status: 'PLANNED',
          scheduledAt: {
            gte: scheduledFrom,
            lte: scheduledTo,
          },
        },
        skip: 0,
        take: 20,
      });
    });

    it('orders only upcoming PLANNED summaries by scheduled date, preserving ownership and page size', async () => {
      const from = new Date('2035-04-01T00:00:00.000Z');
      repository.findManySummary.mockResolvedValue({
        data: [],
        meta: { total: 0, skip: 0, take: 1, totalPages: 0 },
      });

      await service.findMany(athlete, {
        page: 1,
        limit: 1,
        status: 'PLANNED',
        view: 'summary',
        scheduledFrom: from,
        sort: 'scheduledAtAsc',
      });

      expect(repository.findManySummary).toHaveBeenCalledWith({
        where: {
          athleteId: athlete.id,
          status: 'PLANNED',
          scheduledAt: { gte: from },
        },
        skip: 0,
        take: 1,
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      });
      expect(repository.findMany).not.toHaveBeenCalled();
    });

    it('sorts completed summaries by finish time with stable pagination', async () => {
      repository.findManySummary.mockResolvedValue({
        data: [],
        meta: { total: 0, skip: 0, take: 3, totalPages: 0 },
      });

      await service.findMany(athlete, {
        page: 1,
        limit: 3,
        status: 'COMPLETED',
        view: 'summary',
        sort: 'completedAtDesc',
      });

      expect(repository.findManySummary).toHaveBeenCalledWith({
        where: { athleteId: athlete.id, status: 'COMPLETED' },
        skip: 0,
        take: 3,
        orderBy: [{ completedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      });
      expect(repository.findMany).not.toHaveBeenCalled();
    });

    it('rejects completion-date sorting unless status=COMPLETED', async () => {
      for (const status of [undefined, 'PLANNED', 'IN_PROGRESS', 'CANCELLED'] as const) {
        await expect(
          service.findMany(athlete, {
            page: 1,
            limit: 3,
            ...(status ? { status } : {}),
            sort: 'completedAtDesc',
          }),
        ).rejects.toThrow(BadRequestException);
      }
      expect(repository.findMany).not.toHaveBeenCalled();
      expect(repository.findManySummary).not.toHaveBeenCalled();
    });

    it('rejects scheduled sorting without a planned status and lower date bound', async () => {
      const from = new Date('2035-04-01T00:00:00.000Z');
      for (const query of [
        { page: 1, limit: 1, sort: 'scheduledAtAsc' as const, status: 'PLANNED' as const },
        { page: 1, limit: 1, sort: 'scheduledAtAsc' as const, scheduledFrom: from },
        {
          page: 1,
          limit: 1,
          sort: 'scheduledAtAsc' as const,
          status: 'COMPLETED' as const,
          scheduledFrom: from,
        },
      ]) {
        await expect(service.findMany(athlete, query)).rejects.toThrow(BadRequestException);
      }
      expect(repository.findMany).not.toHaveBeenCalled();
      expect(repository.findManySummary).not.toHaveBeenCalled();
    });

    it('should reject invalid pagination', async () => {
      await expect(
        service.findMany(athlete, {
          page: 0,
          limit: 10,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.findMany).not.toHaveBeenCalled();
    });

    it('should reject an invalid scheduled date range', async () => {
      await expect(
        service.findMany(athlete, {
          page: 1,
          limit: 10,
          scheduledFrom: new Date('2026-11-30'),
          scheduledTo: new Date('2026-11-01'),
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a workout owned by the athlete', async () => {
      repository.findById.mockResolvedValue(plannedWorkout);

      const result = await service.findOne('workout-1', athlete);

      expect(result).toEqual(plannedWorkout);

      expect(repository.findById).toHaveBeenCalledWith('workout-1', {
        athleteId: athlete.id,
      });
    });

    it('should hide workouts belonging to another athlete', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('workout-1', athlete)).rejects.toThrow(NotFoundException);
    });

    it('rejects current admins without querying private workout rows', async () => {
      await expect(service.findOne('workout-1', staleAdmin)).rejects.toThrow(ForbiddenException);
      expect(repository.findById).not.toHaveBeenCalled();
    });
  });

  describe('exportCompleted', () => {
    it('requests only the actor’s completed workout and builds a versioned export', async () => {
      repository.findCompletedExport.mockResolvedValue({
        title: 'Upper Body',
        completedAt: new Date('2026-11-23T14:15:00.000Z'),
        exercises: [
          {
            exerciseNameSnapshot: 'Bench Press',
            sets: [
              {
                setNumber: 1,
                actualReps: 8,
                actualWeightKg: new Prisma.Decimal('62.55'),
                actualDurationSeconds: null,
                actualDistanceMeters: null,
                rpe: null,
                rir: 0,
              },
            ],
          },
        ],
      });

      const result = await service.exportCompleted('workout-1', athlete, { locale: 'en' });

      expect(repository.findCompletedExport).toHaveBeenCalledWith('workout-1', athlete.id);
      expect(result.schemaVersion).toBe(1);
      expect(result.workout.exercises[0]?.sets[0]).toMatchObject({
        actualWeightKg: '62.55',
        actualDurationSeconds: null,
        rir: 0,
      });
      expect(result.text).toBe(
        'Workout: Upper Body\nCompleted (UTC): 2026-11-23T14:15:00.000Z\n\nBench Press\n1. 8 reps · 62.55 kg · 0 RIR',
      );
    });

    it('hides missing exports and denormalized legacy rows without a completion time', async () => {
      for (const record of [null, { title: 'Legacy', completedAt: null, exercises: [] }]) {
        repository.findCompletedExport.mockResolvedValue(record);
        await expect(
          service.exportCompleted('workout-1', athlete, { locale: 'uk' }),
        ).rejects.toThrow(NotFoundException);
      }
    });

    it('checks persisted Athlete capability before reading export data', async () => {
      await expect(
        service.exportCompleted('workout-1', staleAdmin, { locale: 'uk' }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.findCompletedExport).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should allow editing a planned workout', async () => {
      repository.findById.mockResolvedValue(plannedWorkout);
      repository.update.mockResolvedValue({
        ...plannedWorkout,
        title: 'Updated Upper Body',
      });

      const result = await service.update('workout-1', athlete, {
        title: 'Updated Upper Body',
      });

      expect(result.title).toBe('Updated Upper Body');

      expect(repository.update).toHaveBeenCalledWith(
        {
          id: 'workout-1',
          athleteId: athlete.id,
          status: 'PLANNED',
        },
        {
          title: 'Updated Upper Body',
        },
        expect.any(Function),
      );
    });

    it('denies a planned edit after account promotion to Admin', async () => {
      repository.findById.mockResolvedValue(plannedWorkout);
      await service.update('workout-1', athlete, { title: 'Denied' });
      const authorize = repository.update.mock.calls[0]?.[2];
      usersService.findMyCapabilitiesForWrite.mockResolvedValue({
        athlete: false,
        trainer: false,
        admin: true,
      });
      await expect(authorize({ id: 'tx' })).rejects.toThrow(ForbiddenException);
      expect(usersService.findMyCapabilitiesForWrite).toHaveBeenCalledWith(
        { id: 'tx' },
        athlete.id,
      );
    });

    it('preserves revoked Trainer access to their own workouts', async () => {
      repository.findById.mockResolvedValue({ ...plannedWorkout, athleteId: trainer.id });
      await service.update('workout-1', trainer, { title: 'Own workout' });
      const authorize = repository.update.mock.calls[0]?.[2];
      usersService.findMyCapabilitiesForWrite.mockResolvedValue({
        athlete: true,
        trainer: false,
        admin: false,
      });
      await expect(authorize({})).resolves.toBeUndefined();
    });

    it('should reject editing a completed workout', async () => {
      repository.findById.mockResolvedValue({
        ...plannedWorkout,
        status: 'COMPLETED',
      });

      await expect(
        service.update('workout-1', athlete, {
          title: 'Updated title',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('should start a planned workout', async () => {
      repository.findById.mockResolvedValue(plannedWorkout);

      repository.startWorkout.mockResolvedValue({
        ...plannedWorkout,
        status: 'IN_PROGRESS',
      });

      const result = await service.start('workout-1', athlete);

      expect(result.status).toBe('IN_PROGRESS');

      expect(repository.startWorkout).toHaveBeenCalledWith({
        id: 'workout-1',
        athleteId: athlete.id,
        startedAt: expect.any(Date),
      });

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should reject starting an already started workout', async () => {
      repository.findById.mockResolvedValue({
        ...plannedWorkout,
        status: 'IN_PROGRESS',
      });

      await expect(service.start('workout-1', athlete)).rejects.toThrow(BadRequestException);

      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('updateSet', () => {
    it('should record actual set performance', async () => {
      repository.findById.mockResolvedValue({
        ...plannedWorkout,
        status: 'IN_PROGRESS',
      });

      repository.updateSet.mockResolvedValue({
        id: 'set-1',
        status: 'COMPLETED',
        actualReps: 8,
        actualWeightKg: 60,
      });

      const result = await service.updateSet('workout-1', 'set-1', athlete, {
        status: 'COMPLETED',
        actualReps: 8,
        actualWeightKg: 60,
        rpe: 8,
      });

      expect(result.status).toBe('COMPLETED');

      expect(repository.updateSet).toHaveBeenCalledWith(
        'set-1',
        expect.objectContaining({
          status: 'COMPLETED',
          actualReps: 8,
          actualWeightKg: 60,
          rpe: 8,
          completedAt: expect.any(Date),
        }),
        expect.objectContaining({
          workoutId: 'workout-1',
          athleteId: athlete.id,
          authorize: expect.any(Function),
        }),
      );
    });

    it('should reject updating sets outside an active workout', async () => {
      repository.findById.mockResolvedValue(plannedWorkout);

      await expect(
        service.updateSet('workout-1', 'set-1', athlete, {
          status: 'COMPLETED',
          actualReps: 8,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.updateSet).not.toHaveBeenCalled();
    });

    it('should reject a set belonging to another workout', async () => {
      repository.findById.mockResolvedValue({
        ...plannedWorkout,
        status: 'IN_PROGRESS',
      });

      await expect(
        service.updateSet('workout-1', 'unknown-set', athlete, {
          status: 'COMPLETED',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(repository.updateSet).not.toHaveBeenCalled();
    });

    it('should reject actual values for skipped sets', async () => {
      repository.findById.mockResolvedValue({
        ...plannedWorkout,
        status: 'IN_PROGRESS',
      });

      await expect(
        service.updateSet('workout-1', 'set-1', athlete, {
          status: 'SKIPPED',
          actualReps: 8,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.updateSet).not.toHaveBeenCalled();
    });

    it('should erase stale performance metrics when a completed set is skipped', async () => {
      repository.findById.mockResolvedValue({
        ...plannedWorkout,
        status: 'IN_PROGRESS',
        exercises: [
          {
            ...plannedWorkout.exercises[0],
            sets: [
              {
                id: 'set-1',
                status: 'COMPLETED',
                actualReps: 8,
                actualWeightKg: 60,
                rpe: 8,
                rir: 2,
              },
            ],
          },
        ],
      });
      repository.updateSet.mockResolvedValue({
        id: 'set-1',
        status: 'SKIPPED',
        actualReps: null,
        actualWeightKg: null,
        rpe: null,
        rir: null,
      });

      const result = await service.updateSet('workout-1', 'set-1', athlete, {
        status: 'SKIPPED',
        notes: 'Skipped due to fatigue',
      });

      expect(result.status).toBe('SKIPPED');
      expect(repository.updateSet).toHaveBeenCalledWith(
        'set-1',
        expect.objectContaining({
          status: 'SKIPPED',
          actualReps: null,
          actualWeightKg: null,
          actualDurationSeconds: null,
          actualDistanceMeters: null,
          rpe: null,
          rir: null,
          notes: 'Skipped due to fatigue',
        }),
        expect.objectContaining({
          workoutId: 'workout-1',
          athleteId: athlete.id,
          authorize: expect.any(Function),
        }),
      );
    });

    it('should reject RPE and RIR values for skipped sets even when called directly', async () => {
      repository.findById.mockResolvedValue({
        ...plannedWorkout,
        status: 'IN_PROGRESS',
      });

      for (const input of [
        { status: 'SKIPPED' as const, rpe: 8 },
        { status: 'SKIPPED' as const, rir: 2 },
      ]) {
        await expect(service.updateSet('workout-1', 'set-1', athlete, input)).rejects.toThrow(
          BadRequestException,
        );
      }

      expect(repository.updateSet).not.toHaveBeenCalled();
    });

    it('should reject a set update when workout state changes concurrently', async () => {
      repository.findById.mockResolvedValue({
        ...plannedWorkout,
        status: 'IN_PROGRESS',
      });

      // Repository detects the completed workout under row lock.
      repository.updateSet.mockResolvedValue(null);

      await expect(
        service.updateSet('workout-1', 'set-1', athlete, {
          status: 'COMPLETED',
          actualReps: 8,
          actualWeightKg: 60,
        }),
      ).rejects.toThrow(ConflictException);

      expect(repository.updateSet).toHaveBeenCalledOnce();
    });

    it('rejects a set write when Athlete was promoted to Admin after preflight', async () => {
      repository.findById.mockResolvedValue({ ...plannedWorkout, status: 'IN_PROGRESS' });
      repository.updateSet.mockResolvedValue({ id: 'set-1', status: 'COMPLETED' });
      await service.updateSet('workout-1', 'set-1', athlete, { status: 'COMPLETED' });
      const context = repository.updateSet.mock.calls[0]?.[2];
      usersService.findMyCapabilitiesForWrite.mockResolvedValue({
        athlete: false,
        trainer: false,
        admin: true,
      });
      await expect(context.authorize({ id: 'tx' })).rejects.toThrow(ForbiddenException);
      expect(usersService.findMyCapabilitiesForWrite).toHaveBeenCalledWith(
        { id: 'tx' },
        athlete.id,
      );
    });

    it('preserves former Trainer access to their own workout sets', async () => {
      repository.findById.mockResolvedValue({
        ...plannedWorkout,
        status: 'IN_PROGRESS',
        athleteId: trainer.id,
      });
      repository.updateSet.mockResolvedValue({ id: 'set-1', status: 'COMPLETED' });
      await service.updateSet('workout-1', 'set-1', trainer, { status: 'COMPLETED' });
      const context = repository.updateSet.mock.calls[0]?.[2];
      usersService.findMyCapabilitiesForWrite.mockResolvedValue({
        athlete: true,
        trainer: false,
        admin: false,
      });
      await expect(context.authorize({})).resolves.toBeUndefined();
    });
  });

  describe('complete', () => {
    it('should complete a workout when all sets are processed', async () => {
      repository.findById.mockResolvedValue({
        ...plannedWorkout,
        status: 'IN_PROGRESS',
        exercises: [
          {
            ...plannedWorkout.exercises[0],
            sets: [
              { id: 'set-1', status: 'COMPLETED' },
              { id: 'set-2', status: 'SKIPPED' },
            ],
          },
        ],
      });

      // Arrange
      repository.completeWorkout.mockResolvedValue({
        status: 'COMPLETED',
        workout: {
          ...plannedWorkout,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Act
      const result = await service.complete('workout-1', athlete);

      // Assert
      expect(result.status).toBe('COMPLETED');
      expect(result.completedAt).toBeInstanceOf(Date);

      expect(repository.completeWorkout).toHaveBeenCalledOnce();

      expect(repository.completeWorkout).toHaveBeenCalledWith({
        id: 'workout-1',
        athleteId: athlete.id,
        completedAt: expect.any(Date),
      });

      // Legacy update must not be used for completion.
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should reject completion when pending sets remain', async () => {
      repository.findById.mockResolvedValue({
        ...plannedWorkout,
        status: 'IN_PROGRESS',
      });

      await expect(service.complete('workout-1', athlete)).rejects.toThrow(BadRequestException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should reject completion when all sets were skipped', async () => {
      repository.findById.mockResolvedValue({
        ...plannedWorkout,
        status: 'IN_PROGRESS',
        exercises: [
          {
            ...plannedWorkout.exercises[0],
            sets: [
              { id: 'set-1', status: 'SKIPPED' },
              { id: 'set-2', status: 'SKIPPED' },
            ],
          },
        ],
      });

      await expect(service.complete('workout-1', athlete)).rejects.toThrow(BadRequestException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should reject completion when no sets exist', async () => {
      repository.findById.mockResolvedValue({
        ...plannedWorkout,
        status: 'IN_PROGRESS',
        exercises: [],
      });

      await expect(service.complete('workout-1', athlete)).rejects.toThrow(BadRequestException);
    });

    it('should reject completion if set results changed after initial validation', async () => {
      repository.findById.mockResolvedValue({
        ...plannedWorkout,
        status: 'IN_PROGRESS',
        exercises: [
          {
            ...plannedWorkout.exercises[0],
            sets: [
              { id: 'set-1', status: 'COMPLETED' },
              { id: 'set-2', status: 'SKIPPED' },
            ],
          },
        ],
      });

      repository.completeWorkout.mockResolvedValue({
        status: 'INVALID_SETS',
      });

      await expect(service.complete('workout-1', athlete)).rejects.toThrow(ConflictException);

      expect(repository.completeWorkout).toHaveBeenCalledWith({
        id: 'workout-1',
        athleteId: athlete.id,
        completedAt: expect.any(Date),
      });
    });
  });

  describe('cancel', () => {
    it('should cancel a planned workout', async () => {
      repository.findById.mockResolvedValue(plannedWorkout);
      repository.update.mockResolvedValue({
        ...plannedWorkout,
        status: 'CANCELLED',
      });

      const result = await service.cancel('workout-1', athlete);

      expect(result.status).toBe('CANCELLED');

      expect(repository.update).toHaveBeenCalledWith(
        {
          id: 'workout-1',
          athleteId: athlete.id,
          status: 'PLANNED',
        },
        { status: 'CANCELLED' },
        expect.any(Function),
      );
    });

    it('denies cancellation after account promotion to Admin', async () => {
      repository.findById.mockResolvedValue(plannedWorkout);
      await service.cancel('workout-1', athlete);
      const authorize = repository.update.mock.calls[0]?.[2];
      usersService.findMyCapabilitiesForWrite.mockResolvedValue({
        athlete: false,
        trainer: false,
        admin: true,
      });
      await expect(authorize({})).rejects.toThrow(ForbiddenException);
    });

    it('should reject cancelling a completed workout', async () => {
      repository.findById.mockResolvedValue({
        ...plannedWorkout,
        status: 'COMPLETED',
      });

      await expect(service.cancel('workout-1', athlete)).rejects.toThrow(BadRequestException);

      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('concurrent updates', () => {
    it('should convert Prisma P2025 into ConflictException', async () => {
      repository.findById.mockResolvedValue(plannedWorkout);

      const prismaError = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '7.10.1',
      });

      repository.startWorkout.mockRejectedValue(prismaError);

      await expect(service.start('workout-1', athlete)).rejects.toThrow(ConflictException);
    });
  });

  describe('idempotency, ownership and concurrent transitions', () => {
    const idempotencyKey = 'workout-key-0001';
    const completedSetsWorkout = {
      ...plannedWorkout,
      status: 'IN_PROGRESS',
      exercises: [
        {
          ...plannedWorkout.exercises[0],
          sets: [
            { id: 'set-1', status: 'COMPLETED' },
            { id: 'set-2', status: 'SKIPPED' },
          ],
        },
      ],
    };

    it('replays a previous creation without rechecking exercises or inserting a duplicate', async () => {
      const previous = workoutIdempotency(idempotencyKey, 'manual', createInput)!;
      const currentWorkout = { ...plannedWorkout, status: 'IN_PROGRESS' };
      repository.findByIdempotencyKey.mockResolvedValueOnce({
        id: plannedWorkout.id,
        idempotencyFingerprint: previous.fingerprint,
      });
      repository.findById.mockResolvedValueOnce(currentWorkout);

      const response = await service.create(athlete, createInput, idempotencyKey);

      expect(response).toBe(currentWorkout);
      expect(repository.findByIdempotencyKey).toHaveBeenCalledWith(athlete.id, idempotencyKey);
      expect(repository.findById).toHaveBeenCalledWith(plannedWorkout.id, {
        athleteId: athlete.id,
      });
      expect(repository.create).not.toHaveBeenCalled();
      expect(exercisesService.findAvailableForWorkout).not.toHaveBeenCalled();
    });

    it('rejects using an existing idempotency key for a different payload', async () => {
      repository.findByIdempotencyKey.mockResolvedValueOnce({
        id: plannedWorkout.id,
        idempotencyFingerprint: 'another-request-fingerprint',
      });

      await expect(service.create(athlete, createInput, idempotencyKey)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.create).not.toHaveBeenCalled();
      expect(trainerAthletesService.getExerciseAccessContext).not.toHaveBeenCalled();
    });

    it('returns the committed winner when concurrent creation loses a unique-key race', async () => {
      const previous = workoutIdempotency(idempotencyKey, 'manual', createInput)!;
      const uniqueError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.1',
      });
      repository.findByIdempotencyKey.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: plannedWorkout.id,
        idempotencyFingerprint: previous.fingerprint,
      });
      repository.create.mockRejectedValueOnce(uniqueError);
      repository.findById.mockResolvedValueOnce(plannedWorkout);

      const result = await service.create(athlete, createInput, idempotencyKey);

      expect(result).toBe(plannedWorkout);
      expect(repository.findByIdempotencyKey).toHaveBeenCalledTimes(2);
      expect(repository.create).toHaveBeenCalledOnce();
    });

    it('propagates unique-key errors if no committed winner exists after a race', async () => {
      const uniqueError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.1',
      });
      repository.findByIdempotencyKey.mockResolvedValue(null);
      repository.create.mockRejectedValueOnce(uniqueError);

      await expect(service.create(athlete, createInput, idempotencyKey)).rejects.toBe(uniqueError);
      expect(repository.findByIdempotencyKey).toHaveBeenCalledTimes(2);
    });

    it('rejects unavailable exercise metadata before persisting a workout', async () => {
      exercisesService.findAvailableForWorkout.mockResolvedValueOnce([]);

      await expect(service.create(athlete, createInput)).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects an empty update instead of sending an unrestricted write', async () => {
      repository.findById.mockResolvedValueOnce(plannedWorkout);

      await expect(service.update(plannedWorkout.id, athlete, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('preserves explicitly cleared notes and scheduling when editing a planned workout', async () => {
      repository.findById.mockResolvedValueOnce(plannedWorkout);
      repository.update.mockResolvedValueOnce(plannedWorkout);

      await service.update(plannedWorkout.id, athlete, {
        title: '  Trimmed workout  ',
        notes: null,
        scheduledAt: null,
      });

      expect(repository.update).toHaveBeenCalledWith(
        { id: plannedWorkout.id, athleteId: athlete.id, status: 'PLANNED' },
        { title: 'Trimmed workout', notes: null, scheduledAt: null },
        expect.any(Function),
      );
    });

    it('turns a lost start state transition into conflict instead of success', async () => {
      repository.findById.mockResolvedValueOnce(plannedWorkout);
      repository.startWorkout.mockResolvedValueOnce(null);

      await expect(service.start(plannedWorkout.id, athlete)).rejects.toThrow(ConflictException);
      expect(repository.startWorkout).toHaveBeenCalledOnce();
    });

    it('persists timing, distance, exertion and notes for a completed set', async () => {
      repository.findById.mockResolvedValueOnce({
        ...plannedWorkout,
        status: 'IN_PROGRESS',
      });
      repository.updateSet.mockResolvedValueOnce({ id: 'set-1', status: 'COMPLETED' });

      await service.updateSet(plannedWorkout.id, 'set-1', athlete, {
        status: 'COMPLETED',
        actualDurationSeconds: 120,
        actualDistanceMeters: 500.5,
        restSeconds: 45,
        rpe: 7.5,
        rir: 2,
        notes: 'Controlled tempo',
      });

      expect(repository.updateSet).toHaveBeenCalledWith(
        'set-1',
        expect.objectContaining({
          status: 'COMPLETED',
          actualDurationSeconds: 120,
          actualDistanceMeters: 500.5,
          restSeconds: 45,
          rpe: 7.5,
          rir: 2,
          notes: 'Controlled tempo',
          completedAt: expect.any(Date),
        }),
        expect.objectContaining({
          workoutId: 'workout-1',
          athleteId: athlete.id,
          authorize: expect.any(Function),
        }),
      );
    });

    it('converts a stale set update P2025 into conflict', async () => {
      repository.findById.mockResolvedValueOnce({
        ...plannedWorkout,
        status: 'IN_PROGRESS',
      });
      repository.updateSet.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Record changed', {
          code: 'P2025',
          clientVersion: '7.10.1',
        }),
      );

      await expect(
        service.updateSet(plannedWorkout.id, 'set-1', athlete, {
          status: 'COMPLETED',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a completion after the state changes while acquiring its lock', async () => {
      repository.findById.mockResolvedValueOnce(completedSetsWorkout);
      repository.completeWorkout.mockResolvedValueOnce({ status: 'NOT_IN_PROGRESS' });

      await expect(service.complete(plannedWorkout.id, athlete)).rejects.toThrow(ConflictException);
      expect(repository.completeWorkout).toHaveBeenCalledOnce();
    });

    it('converts a deleted workout during completion into conflict', async () => {
      repository.findById.mockResolvedValueOnce(completedSetsWorkout);
      repository.completeWorkout.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Record missing', {
          code: 'P2025',
          clientVersion: '7.10.1',
        }),
      );

      await expect(service.complete(plannedWorkout.id, athlete)).rejects.toThrow(ConflictException);
    });

    it('permits cancelling an active workout using its exact previous status', async () => {
      const active = { ...plannedWorkout, status: 'IN_PROGRESS' };
      repository.findById.mockResolvedValueOnce(active);
      repository.update.mockResolvedValueOnce({ ...active, status: 'CANCELLED' });

      const result = await service.cancel(plannedWorkout.id, athlete);

      expect(result.status).toBe('CANCELLED');
      expect(repository.update).toHaveBeenCalledWith(
        { id: plannedWorkout.id, athleteId: athlete.id, status: 'IN_PROGRESS' },
        { status: 'CANCELLED' },
        expect.any(Function),
      );
    });

    it('rejects cancellation when its optimistic status condition no longer matches', async () => {
      repository.findById.mockResolvedValueOnce(plannedWorkout);
      repository.update.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Record missing', {
          code: 'P2025',
          clientVersion: '7.10.1',
        }),
      );

      await expect(service.cancel(plannedWorkout.id, athlete)).rejects.toThrow(ConflictException);
    });

    it('does not leak a foreign workout through update or cancellation', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('another-athlete-workout', athlete, { title: 'Stolen' }),
      ).rejects.toThrow(NotFoundException);
      await expect(service.cancel('another-athlete-workout', athlete)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.findById).toHaveBeenCalledWith('another-athlete-workout', {
        athleteId: athlete.id,
      });
      expect(repository.update).not.toHaveBeenCalled();
    });
  });
});
