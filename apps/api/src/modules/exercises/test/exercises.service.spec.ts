import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { ExercisesService } from '../services/exercises.service.js';
import { ExercisesRepository } from '../repositories/exercises.repository.js';
import { UsersService } from '#src/modules/users/services/users.service';

import type {
  CreateExerciseInput,
  ExerciseAccessContext,
  ExerciseActor,
} from '../types/exercise.types.js';

describe('ExercisesService', () => {
  let service: ExercisesService;

  const usersService = {
    findMyCapabilities: vi.fn(),
    findMyCapabilitiesForWrite: vi.fn(),
    hasTrainerCapability: vi.fn(),
  };

  const repository = {
    create: vi.fn(),
    findMany: vi.fn(),
    findById: vi.fn(),
    findBySlug: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    listMuscleGroups: vi.fn(),
    listEquipment: vi.fn(),
    findMuscleGroupsBySlugs: vi.fn(),
    findEquipmentBySlugs: vi.fn(),
  };

  const athlete: ExerciseActor = {
    id: 'athlete-1',
    role: 'ATHLETE',
  };

  const trainer: ExerciseActor = {
    id: 'trainer-1',
    role: 'TRAINER',
  };

  const admin: ExerciseActor = {
    id: 'admin-1',
    role: 'ADMIN',
  };

  const access: ExerciseAccessContext = {
    activeTrainerIds: ['trainer-1'],
    activeAthleteIds: ['athlete-1'],
  };

  const input: CreateExerciseInput = {
    name: 'Bench Press',
    description: 'Barbell chest exercise',
    exerciseType: 'STRENGTH',
    muscleGroups: [
      {
        slug: 'chest',
        role: 'PRIMARY',
      },
      {
        slug: 'triceps',
        role: 'SECONDARY',
      },
    ],
    equipment: ['barbell', 'bench'],
  };

  const exercise = {
    id: 'exercise-1',
    name: 'Bench Press',
    source: 'ATHLETE_CUSTOM',
    visibility: 'PRIVATE',
    createdById: athlete.id,
    isArchived: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();

    repository.findMuscleGroupsBySlugs.mockResolvedValue([
      { id: 'muscle-1', slug: 'chest' },
      { id: 'muscle-2', slug: 'triceps' },
    ]);

    repository.findEquipmentBySlugs.mockResolvedValue([
      { id: 'equipment-1', slug: 'barbell' },
      { id: 'equipment-2', slug: 'bench' },
    ]);

    usersService.findMyCapabilities.mockImplementation(async (id: string) => ({
      athlete: id !== admin.id,
      trainer: id === trainer.id,
      admin: id === admin.id,
    }));
    const currentForWrite = async (_tx: unknown, id: string) => ({
      athlete: id !== admin.id,
      trainer: id === trainer.id,
      admin: id === admin.id,
    });
    usersService.findMyCapabilitiesForWrite.mockImplementation(currentForWrite);
    usersService.hasTrainerCapability.mockImplementation(async (id: string) => id === trainer.id);

    service = new ExercisesService(
      repository as unknown as ExercisesRepository,
      usersService as unknown as UsersService,
    );
  });

  describe('public taxonomy', () => {
    it('delegates muscle and equipment reads with no ownership context', async () => {
      repository.listMuscleGroups.mockResolvedValue([{ slug: 'chest', name: 'Chest' }]);
      repository.listEquipment.mockResolvedValue([{ slug: 'barbell', name: 'Barbell' }]);

      await expect(service.listMuscleGroups()).resolves.toEqual([{ slug: 'chest', name: 'Chest' }]);
      await expect(service.listEquipment()).resolves.toEqual([
        { slug: 'barbell', name: 'Barbell' },
      ]);
      expect(repository.listMuscleGroups).toHaveBeenCalledOnce();
      expect(repository.listEquipment).toHaveBeenCalledOnce();
    });
  });

  describe('create', () => {
    it('should create an athlete custom exercise', async () => {
      repository.create.mockResolvedValue(exercise);

      const result = await service.create(athlete, input);

      expect(result).toEqual(exercise);

      expect(repository.create.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          name: 'Bench Press',
          source: 'ATHLETE_CUSTOM',
          visibility: 'PRIVATE',
          createdBy: {
            connect: { id: athlete.id },
          },
        }),
      );
    });

    it('should create a trainer custom exercise', async () => {
      repository.create.mockResolvedValue({
        ...exercise,
        source: 'TRAINER_CUSTOM',
        visibility: null,
        createdById: trainer.id,
      });

      await service.create(trainer, input);

      expect(repository.create.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          source: 'TRAINER_CUSTOM',
          visibility: null,
          createdBy: {
            connect: { id: trainer.id },
          },
        }),
      );
    });

    it('should create a global exercise by admin', async () => {
      repository.create.mockResolvedValue({
        ...exercise,
        source: 'GLOBAL',
        visibility: null,
        createdById: admin.id,
      });

      await service.create(admin, input);

      expect(repository.create.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          source: 'GLOBAL',
          visibility: null,
          createdBy: {
            connect: { id: admin.id },
          },
        }),
      );
    });

    it('keeps an approved ATHLETE-role trainer in personal exercise scope by default', async () => {
      usersService.findMyCapabilities.mockResolvedValue({
        athlete: true,
        trainer: true,
        admin: false,
      });

      await service.create(athlete, input);

      expect(usersService.findMyCapabilities).toHaveBeenCalledExactlyOnceWith(athlete.id);
      expect(repository.create.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({ source: 'ATHLETE_CUSTOM', visibility: 'PRIVATE' }),
      );
    });

    it('does not grant trainer exercise creation from a revoked legacy TRAINER role', async () => {
      usersService.findMyCapabilities.mockResolvedValue({
        athlete: true,
        trainer: false,
        admin: false,
      });

      await service.create(trainer, input);

      expect(repository.create.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({ source: 'ATHLETE_CUSTOM', visibility: 'PRIVATE' }),
      );
    });

    it('denies a stale Athlete/Trainer session after the account becomes Admin', async () => {
      usersService.findMyCapabilities.mockResolvedValue({
        athlete: false,
        trainer: false,
        admin: true,
      });

      await expect(service.create(athlete, input)).rejects.toThrow(ForbiddenException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('denies stale Admin global writes after privilege revocation', async () => {
      usersService.findMyCapabilities.mockResolvedValue({
        athlete: true,
        trainer: false,
        admin: false,
      });

      await expect(service.create(admin, input)).rejects.toThrow(ForbiddenException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('fails closed when the persisted account cannot be verified', async () => {
      usersService.findMyCapabilities.mockRejectedValue(new Error('Database unavailable'));

      await expect(service.create(trainer, input)).rejects.toThrow('Database unavailable');
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('supports explicit Trainer scope for an approved ATHLETE-role trainer', async () => {
      usersService.findMyCapabilities.mockResolvedValue({
        athlete: true,
        trainer: true,
        admin: false,
      });

      await service.create(athlete, { ...input, creationScope: 'TRAINER' });

      expect(repository.create.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({ source: 'TRAINER_CUSTOM', visibility: null }),
      );
    });

    it('supports explicit personal scope for an approved legacy TRAINER', async () => {
      await service.create(trainer, { ...input, creationScope: 'ATHLETE' });

      expect(repository.create.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({ source: 'ATHLETE_CUSTOM', visibility: 'PRIVATE' }),
      );
    });

    it('never falls back when explicitly requested Trainer scope was revoked', async () => {
      usersService.findMyCapabilities.mockResolvedValue({
        athlete: true,
        trainer: false,
        admin: false,
      });

      const requested: CreateExerciseInput = { ...input, creationScope: 'TRAINER' };
      await expect(service.create(trainer, requested)).rejects.toThrow(ForbiddenException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('does not accept personal scope on an Admin account', async () => {
      const requested: CreateExerciseInput = { ...input, creationScope: 'ATHLETE' };
      await expect(service.create(admin, requested)).rejects.toThrow(ForbiddenException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects visibility on explicit Trainer creation scope', async () => {
      usersService.findMyCapabilities.mockResolvedValue({
        athlete: true,
        trainer: true,
        admin: false,
      });

      await expect(
        service.create(athlete, {
          ...input,
          creationScope: 'TRAINER',
          visibility: 'PRIVATE',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('holds a live capability check for the transaction before returning a write', async () => {
      await service.create(trainer, input);

      const verify = repository.create.mock.calls[0]?.[1];
      expect(verify).toEqual(expect.any(Function));
      await expect(verify({ id: 'tx' })).resolves.toBeUndefined();
      expect(usersService.findMyCapabilitiesForWrite).toHaveBeenCalledExactlyOnceWith(
        { id: 'tx' },
        trainer.id,
      );
    });

    it('rejects an implicit Trainer write if its source changed after preflight', async () => {
      await service.create(trainer, input);
      usersService.findMyCapabilitiesForWrite.mockResolvedValue({
        athlete: true,
        trainer: false,
        admin: false,
      });

      const verify = repository.create.mock.calls[0]?.[1];
      await expect(verify({})).rejects.toThrow(ForbiddenException);
    });

    it('rejects an explicit Trainer write after revocation', async () => {
      usersService.findMyCapabilities.mockResolvedValue({
        athlete: true,
        trainer: true,
        admin: false,
      });
      await service.create(athlete, { ...input, creationScope: 'TRAINER' });
      usersService.findMyCapabilitiesForWrite.mockResolvedValue({
        athlete: true,
        trainer: false,
        admin: false,
      });

      const verify = repository.create.mock.calls[0]?.[1];
      await expect(verify({})).rejects.toThrow(ForbiddenException);
    });

    it('rejects a global exercise when Admin capability is demoted before commit', async () => {
      await service.create(admin, input);
      usersService.findMyCapabilitiesForWrite.mockResolvedValue({
        athlete: true,
        trainer: false,
        admin: false,
      });

      const verify = repository.create.mock.calls[0]?.[1];
      await expect(verify({})).rejects.toThrow(ForbiddenException);
    });

    it('rejects a personal exercise when the account becomes Admin before commit', async () => {
      await service.create(athlete, input);
      usersService.findMyCapabilitiesForWrite.mockResolvedValue({
        athlete: false,
        trainer: false,
        admin: true,
      });

      const verify = repository.create.mock.calls[0]?.[1];
      await expect(verify({})).rejects.toThrow(ForbiddenException);
    });

    it('propagates locked capability lookup errors before a write', async () => {
      await service.create(trainer, input);
      usersService.findMyCapabilitiesForWrite.mockRejectedValue(new Error('DB unavailable'));

      const verify = repository.create.mock.calls[0]?.[1];
      await expect(verify({})).rejects.toThrow('DB unavailable');
    });

    it('should reject visibility for trainer exercises', async () => {
      await expect(
        service.create(trainer, {
          ...input,
          visibility: 'PRIVATE',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should reject duplicate muscle groups', async () => {
      await expect(
        service.create(athlete, {
          ...input,
          muscleGroups: [
            { slug: 'chest', role: 'PRIMARY' },
            { slug: 'chest', role: 'SECONDARY' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should require at least one primary muscle group', async () => {
      await expect(
        service.create(athlete, {
          ...input,
          muscleGroups: [{ slug: 'chest', role: 'SECONDARY' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown muscle groups', async () => {
      repository.findMuscleGroupsBySlugs.mockResolvedValue([]);

      await expect(service.create(athlete, input)).rejects.toThrow(BadRequestException);

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should reject unknown equipment', async () => {
      repository.findEquipmentBySlugs.mockResolvedValue([]);

      await expect(service.create(athlete, input)).rejects.toThrow(BadRequestException);

      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findMany', () => {
    it('should return exercises with pagination', async () => {
      const response = {
        data: [exercise],
        meta: {
          total: 1,
          skip: 0,
          take: 10,
          totalPages: 1,
        },
      };

      repository.findMany.mockResolvedValue(response);

      const result = await service.findMany(
        athlete,
        {
          page: 1,
          limit: 10,
        },
        access,
      );

      expect(result).toEqual(response);

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });

    it('should filter exercises by search and muscle group', async () => {
      repository.findMany.mockResolvedValue({
        data: [],
        meta: {},
      });

      await service.findMany(
        athlete,
        {
          page: 1,
          limit: 10,
          search: 'bench',
          muscleGroup: 'chest',
          equipment: 'barbell',
          exerciseType: 'STRENGTH',
        },
        access,
      );

      const call = repository.findMany.mock.calls[0][0];

      expect(call.where.AND).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: {
              contains: 'bench',
              mode: 'insensitive',
            },
          }),
          expect.objectContaining({
            exerciseType: 'STRENGTH',
          }),
          expect.objectContaining({
            muscleGroups: expect.any(Object),
          }),
          expect.objectContaining({
            equipment: expect.any(Object),
          }),
        ]),
      );
    });

    it('should show global exercises to guests', async () => {
      repository.findMany.mockResolvedValue({
        data: [],
        meta: {},
      });

      await service.findMany(
        null,
        { page: 1, limit: 10 },
        {
          activeTrainerIds: [],
          activeAthleteIds: [],
        },
      );

      const call = repository.findMany.mock.calls[0][0];

      expect(call.where).toEqual({
        AND: [{ source: 'GLOBAL' }, { isArchived: false }],
      });
    });

    it('scopes Admin list reads to global catalog, not Athlete private exercises', async () => {
      repository.findMany.mockResolvedValue({ data: [], meta: {} });

      await service.findMany(admin, { page: 1, limit: 10 }, access);

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ source: 'GLOBAL' }, { isArchived: false }] },
        }),
      );
    });

    it('should reject invalid pagination', async () => {
      await expect(
        service.findMany(
          athlete,
          {
            page: 0,
            limit: 10,
          },
          access,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(repository.findMany).not.toHaveBeenCalled();
    });

    it('should reject pagination limit above 100', async () => {
      await expect(
        service.findMany(
          athlete,
          {
            page: 1,
            limit: 101,
          },
          access,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return an accessible exercise', async () => {
      repository.findById.mockResolvedValue(exercise);

      const result = await service.findOne(exercise.id, athlete, access);

      expect(result).toEqual(exercise);
    });

    it('should throw NotFoundException when exercise is missing', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('missing-id', athlete, access)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('uses the global-only predicate for Admin detail reads', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('foreign-private-id', admin, access)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.findById).toHaveBeenCalledWith('foreign-private-id', {
        AND: [{ source: 'GLOBAL' }, { isArchived: false }],
      });
    });

    it('should not expose private exercises to guests', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findOne('exercise-1', null, {
          activeTrainerIds: [],
          activeAthleteIds: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAvailableForTrainingProgram', () => {
    it('should allow global exercises', async () => {
      const globalExercise = {
        ...exercise,
        source: 'GLOBAL',
        visibility: null,
        createdById: null,
      };

      repository.findById.mockResolvedValue(globalExercise);

      const result = await service.findAvailableForTrainingProgram('exercise-1', trainer);

      expect(result).toEqual(globalExercise);

      expect(repository.findById).toHaveBeenCalledWith('exercise-1', {
        isArchived: false,
        OR: [
          { source: 'GLOBAL' },
          {
            source: 'TRAINER_CUSTOM',
            createdById: trainer.id,
          },
        ],
      });
    });

    it('allows an approved ATHLETE-role trainer to use global exercises', async () => {
      usersService.hasTrainerCapability.mockResolvedValue(true);
      repository.findById.mockResolvedValue({ ...exercise, source: 'GLOBAL' });

      await expect(service.findAvailableForTrainingProgram('exercise-1', athlete)).resolves.toEqual(
        expect.objectContaining({ source: 'GLOBAL' }),
      );
      expect(usersService.hasTrainerCapability).toHaveBeenCalledExactlyOnceWith(athlete.id);
      const scopedLookup = repository.findById.mock.calls[0]?.[1];
      expect(scopedLookup?.isArchived).toBe(false);
      expect(scopedLookup?.OR).toContainEqual({ source: 'GLOBAL' });
      const ownedTrainer = { source: 'TRAINER_CUSTOM', createdById: athlete.id };
      expect(scopedLookup?.OR).toContainEqual(ownedTrainer);
    });

    it('allows an approved ATHLETE-role trainer only their own trainer exercises', async () => {
      usersService.hasTrainerCapability.mockResolvedValue(true);
      repository.findById.mockResolvedValue({ ...exercise, source: 'TRAINER_CUSTOM' });

      await service.findAvailableForTrainingProgram('exercise-1', athlete);

      const scopedLookup = repository.findById.mock.calls[0]?.[1];
      const ownedTrainer = { source: 'TRAINER_CUSTOM', createdById: athlete.id };
      expect(scopedLookup?.OR).toContainEqual(ownedTrainer);
    });

    it('denies a revoked legacy TRAINER before reading even a global exercise', async () => {
      usersService.hasTrainerCapability.mockResolvedValue(false);

      await expect(service.findAvailableForTrainingProgram('exercise-1', trainer)).rejects.toThrow(
        ForbiddenException,
      );
      expect(usersService.hasTrainerCapability).toHaveBeenCalledExactlyOnceWith(trainer.id);
      expect(repository.findById).not.toHaveBeenCalled();
    });

    it('fails closed when persisted capability verification is unavailable', async () => {
      usersService.hasTrainerCapability.mockRejectedValue(new Error('Database unavailable'));

      await expect(service.findAvailableForTrainingProgram('exercise-1', trainer)).rejects.toThrow(
        'Database unavailable',
      );
      expect(repository.findById).not.toHaveBeenCalled();
    });

    it('should allow trainer-owned custom exercises', async () => {
      const trainerExercise = {
        ...exercise,
        source: 'TRAINER_CUSTOM',
        visibility: null,
        createdById: trainer.id,
      };

      repository.findById.mockResolvedValue(trainerExercise);

      const result = await service.findAvailableForTrainingProgram('exercise-1', trainer);

      expect(result).toEqual(trainerExercise);
    });

    it('should reject athlete custom exercises', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findAvailableForTrainingProgram('exercise-1', trainer)).rejects.toThrow(
        NotFoundException,
      );

      expect(repository.findById).toHaveBeenCalledWith('exercise-1', {
        isArchived: false,
        OR: [
          { source: 'GLOBAL' },
          {
            source: 'TRAINER_CUSTOM',
            createdById: trainer.id,
          },
        ],
      });
    });

    it('should reject non-trainers', async () => {
      await expect(service.findAvailableForTrainingProgram('exercise-1', athlete)).rejects.toThrow(
        ForbiddenException,
      );

      expect(repository.findById).not.toHaveBeenCalled();
    });

    it('should reject missing exercises', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findAvailableForTrainingProgram('missing-id', trainer)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should allow the owner to update their exercise', async () => {
      repository.findById.mockResolvedValue(exercise);
      repository.update.mockResolvedValue({
        ...exercise,
        name: 'Updated Bench Press',
      });

      await service.update(exercise.id, athlete, {
        name: 'Updated Bench Press',
      });

      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: exercise.id,
          createdById: athlete.id,
          source: 'ATHLETE_CUSTOM',
          isArchived: false,
        }),
        expect.objectContaining({
          name: 'Updated Bench Press',
        }),
        expect.any(Function),
      );
    });

    it('hides foreign custom exercises during update before any write', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update(exercise.id, athlete, { name: 'Changed name' })).rejects.toThrow(
        NotFoundException,
      );

      expect(repository.findById).toHaveBeenCalledWith(exercise.id, {
        isArchived: false,
        OR: [{ source: 'GLOBAL' }, { source: { not: 'GLOBAL' }, createdById: athlete.id }],
      });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('defensively maps a foreign custom exercise to 404 even if a repository mock returns it', async () => {
      repository.findById.mockResolvedValue({
        ...exercise,
        createdById: 'another-athlete',
      });
      await expect(service.update(exercise.id, athlete, { name: 'Changed name' })).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('keeps 403 when a non-admin attempts to update a global exercise', async () => {
      repository.findById.mockResolvedValue({
        ...exercise,
        source: 'GLOBAL',
        createdById: null,
      });
      await expect(
        service.update(exercise.id, athlete, { name: 'Cannot update global' }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should allow admin to update global exercises', async () => {
      repository.findById.mockResolvedValue({
        ...exercise,
        source: 'GLOBAL',
        createdById: null,
      });

      repository.update.mockResolvedValue({
        ...exercise,
        source: 'GLOBAL',
      });

      await service.update(exercise.id, admin, {
        name: 'Updated Global Exercise',
      });

      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: exercise.id,
          source: 'GLOBAL',
          isArchived: false,
        }),
        expect.objectContaining({
          name: 'Updated Global Exercise',
        }),
        expect.any(Function),
      );
    });

    it('should revoke trainer access when visibility becomes private', async () => {
      repository.findById.mockResolvedValue(exercise);
      repository.update.mockResolvedValue({
        ...exercise,
        visibility: 'PRIVATE',
      });

      await service.update(exercise.id, athlete, { visibility: 'PRIVATE' });

      expect(repository.update).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          visibility: 'PRIVATE',
          trainerAccesses: {
            updateMany: {
              where: { revokedAt: null },
              data: expect.objectContaining({
                revokedAt: expect.any(Date),
              }),
            },
          },
        }),
        expect.any(Function),
      );
    });
    it('denies a stale Admin update after demotion at final write checkpoint', async () => {
      repository.findById.mockResolvedValue({ ...exercise, source: 'GLOBAL', createdById: null });
      await service.update(exercise.id, admin, { name: 'Denied' });
      const authorize = repository.update.mock.calls[0]?.[2];
      usersService.findMyCapabilitiesForWrite.mockResolvedValue({
        athlete: true, trainer: false, admin: false,
      });
      await expect(authorize({ id: 'tx' })).rejects.toThrow(ForbiddenException);
      expect(usersService.findMyCapabilitiesForWrite).toHaveBeenCalledWith(
        { id: 'tx' }, admin.id,
      );
    });

    it('denies an Athlete update after account promotion to Admin', async () => {
      repository.findById.mockResolvedValue(exercise);
      await service.update(exercise.id, athlete, { name: 'Denied' });
      const authorize = repository.update.mock.calls[0]?.[2];
      usersService.findMyCapabilitiesForWrite.mockResolvedValue({
        athlete: false, trainer: false, admin: true,
      });
      await expect(authorize({})).rejects.toThrow(ForbiddenException);
    });

    it('preserves a revoked Trainer ability to edit their own exercises', async () => {
      repository.findById.mockResolvedValue({
        ...exercise, createdById: trainer.id, source: 'TRAINER_CUSTOM',
      });
      await service.update(exercise.id, trainer, { name: 'Owned' });
      const authorize = repository.update.mock.calls[0]?.[2];
      usersService.findMyCapabilitiesForWrite.mockResolvedValue({
        athlete: true, trainer: false, admin: false,
      });
      await expect(authorize({})).resolves.toBeUndefined();
    });

  });

  describe('archive', () => {
    it('should allow the owner to archive their exercise', async () => {
      repository.findById.mockResolvedValue(exercise);

      repository.archive.mockResolvedValue({
        id: exercise.id,
        isArchived: true,
      });

      const result = await service.archive(exercise.id, athlete);

      expect(result).toEqual({
        id: exercise.id,
        isArchived: true,
      });

      expect(repository.archive).toHaveBeenCalledWith(
        expect.objectContaining({
          id: exercise.id,
          createdById: athlete.id,
          source: 'ATHLETE_CUSTOM',
          isArchived: false,
        }),
        expect.any(Function),
      );
    });

    it('hides foreign custom exercises during archive before any write', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.archive(exercise.id, athlete)).rejects.toThrow(NotFoundException);

      expect(repository.findById).toHaveBeenCalledWith(exercise.id, {
        isArchived: false,
        OR: [{ source: 'GLOBAL' }, { source: { not: 'GLOBAL' }, createdById: athlete.id }],
      });
      expect(repository.archive).not.toHaveBeenCalled();
    });

    it('defensively maps foreign custom archive attempts to 404', async () => {
      repository.findById.mockResolvedValue({
        ...exercise,
        createdById: 'another-athlete',
      });
      await expect(service.archive(exercise.id, athlete)).rejects.toThrow(NotFoundException);
      expect(repository.archive).not.toHaveBeenCalled();
    });

    it('keeps 403 when a non-admin attempts to archive a global exercise', async () => {
      repository.findById.mockResolvedValue({
        ...exercise,
        source: 'GLOBAL',
        createdById: null,
      });
      await expect(service.archive(exercise.id, athlete)).rejects.toThrow(ForbiddenException);
      expect(repository.archive).not.toHaveBeenCalled();
    });

    it('allows admin to archive global exercises', async () => {
      repository.findById.mockResolvedValue({
        ...exercise,
        source: 'GLOBAL',
        createdById: null,
      });
      repository.archive.mockResolvedValue({ id: exercise.id, isArchived: true });
      await expect(service.archive(exercise.id, admin)).resolves.toEqual({
        id: exercise.id,
        isArchived: true,
      });
      expect(repository.archive).toHaveBeenCalledWith(
        {
          id: exercise.id,
          source: 'GLOBAL',
          isArchived: false,
        },
        expect.any(Function),
      );
    });

    it('denies a stale Admin archive after demotion at final write checkpoint', async () => {
      repository.findById.mockResolvedValue({ ...exercise, source: 'GLOBAL', createdById: null });
      await service.archive(exercise.id, admin);
      const authorize = repository.archive.mock.calls[0]?.[1];
      usersService.findMyCapabilitiesForWrite.mockResolvedValue({
        athlete: true, trainer: false, admin: false,
      });
      await expect(authorize({})).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when exercise is missing', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.archive('missing-id', athlete)).rejects.toThrow(NotFoundException);

      expect(repository.archive).not.toHaveBeenCalled();
    });
  });
});
