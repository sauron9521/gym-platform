import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '#prisma/client';

import { UsersService } from '#src/modules/users/services/users.service';
import { TrainerAthletesRepository } from '../repositories/trainer-athletes.repository.js';
import { TrainerAthletesService } from '../services/trainer-athletes.service.js';
import { TrainerAthleteTerminationService } from '../services/trainer-athlete-termination.service.js';

import type { TrainerAthleteActor } from '../types/trainer-athlete.types.js';

describe('TrainerAthletesService', () => {
  let service: TrainerAthletesService;

  const repository = {
    create: vi.fn(),
    findMany: vi.fn(),
    findManyForParticipant: vi.fn(),
    findById: vi.fn(),
    findHistoricalById: vi.fn(),
    findOpenByPair: vi.fn(),
    update: vi.fn(),
    findActiveTrainerIdsForAthlete: vi.fn(),
    findActiveAthleteIdsForTrainer: vi.fn(),
  };

  const terminationService = {
    terminateWithExerciseCopies: vi.fn(),
  };

  const usersService = {
    findMyCapabilities: vi.fn(),
  };

  const trainer: TrainerAthleteActor = {
    id: 'trainer-1',
    role: 'TRAINER',
  };

  const athlete: TrainerAthleteActor = {
    id: 'athlete-1',
    role: 'ATHLETE',
  };

  const admin: TrainerAthleteActor = {
    id: 'admin-1',
    role: 'ADMIN',
  };

  const pendingRelationship = {
    id: 'relationship-1',
    trainerId: trainer.id,
    athleteId: athlete.id,
    initiatedById: trainer.id,
    status: 'PENDING',
  };

  const activeRelationship = {
    ...pendingRelationship,
    status: 'ACTIVE',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    usersService.findMyCapabilities.mockImplementation(async (id: string) => ({
      athlete: id !== admin.id,
      trainer: id.startsWith('trainer-'),
      admin: id === admin.id,
    }));
    repository.findActiveTrainerIdsForAthlete.mockResolvedValue([]);

    service = new TrainerAthletesService(
      repository as unknown as TrainerAthletesRepository,
      terminationService as unknown as TrainerAthleteTerminationService,
      usersService as unknown as UsersService,
    );
  });

  describe('create', () => {
    it('approved ATHLETE can invite an athlete without changing session role', async () => {
      usersService.findMyCapabilities.mockImplementation(async (id: string) => ({
        athlete: true,
        trainer: id === athlete.id,
        admin: false,
      }));
      repository.findOpenByPair.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        ...pendingRelationship,
        trainerId: athlete.id,
        athleteId: 'athlete-2',
        initiatedById: athlete.id,
      });

      const result = await service.create(athlete, { userId: 'athlete-2' });

      expect(result).toMatchObject({ trainerId: athlete.id, athleteId: 'athlete-2' });
      expect(repository.findOpenByPair).toHaveBeenCalledExactlyOnceWith(athlete.id, 'athlete-2');
    });

    it('allows a regular athlete to invite a newly approved ATHLETE-role trainer', async () => {
      usersService.findMyCapabilities.mockImplementation(async (id: string) => ({
        athlete: true,
        trainer: id === 'approved-1',
        admin: false,
      }));
      repository.findOpenByPair.mockResolvedValue(null);
      repository.create.mockResolvedValue(pendingRelationship);

      await service.create(athlete, { userId: 'approved-1' });

      expect(repository.findOpenByPair).toHaveBeenCalledExactlyOnceWith('approved-1', athlete.id);
    });

    it('rejects a revoked TRAINER session trying to invite an athlete', async () => {
      usersService.findMyCapabilities.mockImplementation(async () => ({
        athlete: true,
        trainer: false,
        admin: false,
      }));

      await expect(service.create(trainer, { userId: athlete.id })).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.findOpenByPair).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects an athlete inviting a trainer whose capability was revoked', async () => {
      usersService.findMyCapabilities.mockImplementation(async () => ({
        athlete: true,
        trainer: false,
        admin: false,
      }));

      await expect(service.create(athlete, { userId: trainer.id })).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects ambiguous dual-trainer invitations', async () => {
      usersService.findMyCapabilities.mockResolvedValue({
        athlete: true,
        trainer: true,
        admin: false,
      });

      await expect(service.create(trainer, { userId: 'another-trainer' })).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.findOpenByPair).not.toHaveBeenCalled();
    });

    it('does not permit a new invitation after an account capability lookup fails', async () => {
      usersService.findMyCapabilities.mockRejectedValue(new Error('Database unavailable'));

      await expect(service.create(trainer, { userId: athlete.id })).rejects.toThrow(
        'Database unavailable',
      );
      expect(repository.findOpenByPair).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('does not permit an athlete to invite an admin target', async () => {
      usersService.findMyCapabilities.mockImplementation(async (id: string) => ({
        athlete: id !== admin.id,
        trainer: false,
        admin: id === admin.id,
      }));

      await expect(service.create(athlete, { userId: admin.id })).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should allow a trainer to invite an athlete', async () => {
      repository.findOpenByPair.mockResolvedValue(null);
      repository.create.mockResolvedValue(pendingRelationship);

      const result = await service.create(trainer, {
        userId: athlete.id,
      });

      expect(result).toEqual(pendingRelationship);

      expect(repository.findOpenByPair).toHaveBeenCalledWith(trainer.id, athlete.id);

      expect(repository.create).toHaveBeenCalledWith({
        trainer: {
          connect: { id: trainer.id },
        },
        athlete: {
          connect: { id: athlete.id },
        },
        initiatedBy: {
          connect: { id: trainer.id },
        },
      });
    });

    it('should allow an athlete to invite a trainer', async () => {
      repository.findOpenByPair.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        ...pendingRelationship,
        initiatedById: athlete.id,
      });

      await service.create(athlete, {
        userId: trainer.id,
      });

      expect(repository.create).toHaveBeenCalledWith({
        trainer: {
          connect: { id: trainer.id },
        },
        athlete: {
          connect: { id: athlete.id },
        },
        initiatedBy: {
          connect: { id: athlete.id },
        },
      });
    });

    it('should reject creating a relationship with yourself', async () => {
      await expect(service.create(trainer, { userId: trainer.id })).rejects.toThrow(
        BadRequestException,
      );

      expect(usersService.findMyCapabilities).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should reject a missing target user', async () => {
      usersService.findMyCapabilities
        .mockResolvedValueOnce({ athlete: true, trainer: true, admin: false })
        .mockRejectedValueOnce(new NotFoundException('User not found'));

      await expect(service.create(trainer, { userId: athlete.id })).rejects.toThrow(
        NotFoundException,
      );

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should reject a trainer inviting another trainer', async () => {
      await expect(service.create(trainer, { userId: trainer.id + '-2' })).rejects.toThrow(
        BadRequestException,
      );

      expect(repository.findOpenByPair).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should reject an athlete inviting another athlete', async () => {
      await expect(service.create(athlete, { userId: athlete.id + '-2' })).rejects.toThrow(
        BadRequestException,
      );

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should reject users with unsupported roles', async () => {
      await expect(service.create(admin, { userId: athlete.id })).rejects.toThrow(
        ForbiddenException,
      );

      expect(usersService.findMyCapabilities).toHaveBeenCalledExactlyOnceWith(admin.id);
    });

    it('should reject an existing pending or active relationship', async () => {
      repository.findOpenByPair.mockResolvedValue({
        id: 'relationship-existing',
        status: 'ACTIVE',
      });

      await expect(service.create(trainer, { userId: athlete.id })).rejects.toThrow(
        ConflictException,
      );

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should handle a concurrent duplicate request', async () => {
      repository.findOpenByPair.mockResolvedValue(null);

      repository.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.10.1',
        }),
      );

      await expect(service.create(trainer, { userId: athlete.id })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findMany', () => {
    it('should return relationships for the current trainer', async () => {
      const response = {
        data: [pendingRelationship],
        meta: {
          total: 1,
          skip: 0,
          take: 20,
          totalPages: 1,
        },
      };

      repository.findManyForParticipant.mockResolvedValue(response);

      const result = await service.findMany(trainer, {
        page: 1,
        limit: 20,
        status: 'PENDING',
      });

      expect(result).toEqual(response);

      expect(repository.findManyForParticipant).toHaveBeenCalledWith(
        {
          where: {
            OR: [{ trainerId: trainer.id }, { athleteId: trainer.id }],
            status: 'PENDING',
          },
          skip: 0,
          take: 20,
        },
        trainer.id,
      );
    });

    it('should reject invalid pagination', async () => {
      await expect(
        service.findMany(trainer, {
          page: 0,
          limit: 20,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.findManyForParticipant).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('redacts former trainer history even when the session role is ATHLETE', async () => {
      const approvedTrainer: TrainerAthleteActor = { id: trainer.id, role: 'ATHLETE' };
      const restricted = {
        id: 'relationship-1',
        trainerId: trainer.id,
        athleteId: athlete.id,
        status: 'TERMINATED',
        athlete: { id: athlete.id, role: 'ATHLETE' },
      };
      repository.findById.mockResolvedValue(null);
      repository.findHistoricalById.mockResolvedValue(restricted);

      await expect(service.findOne(restricted.id, approvedTrainer)).resolves.toEqual(restricted);
      expect(repository.findHistoricalById).toHaveBeenCalledWith(restricted.id, {
        trainerId: trainer.id,
      });
    });

    it('should return a relationship for its participant', async () => {
      repository.findById.mockResolvedValue(pendingRelationship);

      const result = await service.findOne(pendingRelationship.id, trainer);

      expect(result).toEqual(pendingRelationship);

      expect(repository.findById).toHaveBeenCalledWith(pendingRelationship.id, {
        AND: [
          {
            OR: [{ trainerId: trainer.id }, { athleteId: trainer.id }],
          },
          {
            OR: [{ status: { in: ['ACTIVE', 'PENDING'] } }, { athleteId: trainer.id }],
          },
        ],
      });

      expect(repository.findHistoricalById).not.toHaveBeenCalled();
    });

    it('should hide relationships from unrelated users', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findOne('relationship-1', {
          id: 'another-user',
          role: 'ATHLETE',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return historical relationship data for a former trainer', async () => {
      const historicalRelationship = {
        ...activeRelationship,
        status: 'TERMINATED',
        athlete: {
          id: athlete.id,
          role: 'ATHLETE',
        },
        trainer: {
          id: trainer.id,
          role: 'TRAINER',
        },
        initiatedBy: {
          id: trainer.id,
          role: 'TRAINER',
        },
        endedBy: null,
      };

      // No active or pending relationship exists.
      repository.findById.mockResolvedValue(null);

      // The repository returns a safe historical projection.
      repository.findHistoricalById.mockResolvedValue(historicalRelationship);

      const result = await service.findOne(historicalRelationship.id, trainer);

      expect(result).toEqual(historicalRelationship);

      expect(repository.findHistoricalById).toHaveBeenCalledWith(historicalRelationship.id, {
        trainerId: trainer.id,
      });

      expect(repository.findById).toHaveBeenCalledWith(historicalRelationship.id, {
        AND: [
          {
            OR: [{ trainerId: trainer.id }, { athleteId: trainer.id }],
          },
          {
            OR: [{ status: { in: ['ACTIVE', 'PENDING'] } }, { athleteId: trainer.id }],
          },
        ],
      });
    });

    it('should preserve full historical relationship access for the athlete', async () => {
      const historicalRelationship = {
        ...activeRelationship,
        status: 'TERMINATED',
        athlete: {
          id: athlete.id,
          email: 'athlete@example.com',
          role: 'ATHLETE',
        },
        trainer: {
          id: trainer.id,
          email: 'trainer@example.com',
          role: 'TRAINER',
        },
      };

      repository.findById.mockResolvedValue(historicalRelationship);

      const result = await service.findOne(historicalRelationship.id, athlete);

      expect(result).toEqual(historicalRelationship);

      expect(repository.findById).toHaveBeenCalledWith(historicalRelationship.id, {
        AND: [
          { OR: [{ trainerId: athlete.id }, { athleteId: athlete.id }] },
          {
            OR: [{ status: { in: ['ACTIVE', 'PENDING'] } }, { athleteId: athlete.id }],
          },
        ],
      });

      // The athlete must not use the restricted trainer path.
      expect(repository.findHistoricalById).not.toHaveBeenCalled();
    });
  });

  describe('accept', () => {
    it('rejects accepting when the trainer capability has been revoked', async () => {
      repository.findById.mockResolvedValue(pendingRelationship);
      usersService.findMyCapabilities.mockImplementation(async () => ({
        athlete: true,
        trainer: false,
        admin: false,
      }));

      await expect(service.accept(pendingRelationship.id, athlete)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('allows an approved ATHLETE-role trainer to accept an athlete invitation', async () => {
      repository.findById.mockResolvedValue({
        ...pendingRelationship,
        initiatedById: athlete.id,
      });
      repository.update.mockResolvedValue(activeRelationship);
      const approvedTrainer: TrainerAthleteActor = { id: trainer.id, role: 'ATHLETE' };

      await expect(service.accept(pendingRelationship.id, approvedTrainer)).resolves.toEqual(
        activeRelationship,
      );
      expect(repository.update).toHaveBeenCalledOnce();
    });

    it('rejects activation after an actor is promoted to admin', async () => {
      repository.findById.mockResolvedValue(pendingRelationship);
      usersService.findMyCapabilities.mockImplementation(async (id: string) => ({
        athlete: id !== athlete.id ? true : false,
        trainer: false,
        admin: id === athlete.id,
      }));

      await expect(service.accept(pendingRelationship.id, athlete)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects acceptance when the athlete account is not eligible', async () => {
      repository.findById.mockResolvedValue({
        ...pendingRelationship,
        initiatedById: athlete.id,
      });
      usersService.findMyCapabilities.mockImplementation(async (id: string) => ({
        athlete: id !== athlete.id,
        trainer: id === trainer.id,
        admin: false,
      }));

      await expect(service.accept(pendingRelationship.id, trainer)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('does not activate a pending relationship when capability lookup fails', async () => {
      repository.findById.mockResolvedValue(pendingRelationship);
      usersService.findMyCapabilities.mockRejectedValue(new Error('Database unavailable'));

      await expect(service.accept(pendingRelationship.id, athlete)).rejects.toThrow(
        'Database unavailable',
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should allow the recipient to accept a request', async () => {
      repository.findById.mockResolvedValue(pendingRelationship);
      repository.update.mockResolvedValue(activeRelationship);

      const result = await service.accept(pendingRelationship.id, athlete);

      expect(result).toEqual(activeRelationship);

      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: pendingRelationship.id,
          status: 'PENDING',
          trainer: {
            is: {
              deletedAt: null,
              role: { not: 'ADMIN' },
              OR: [
                { trainerProfile: { is: { isActive: true } } },
                { role: 'TRAINER', trainerProfile: { is: null } },
              ],
            },
          },
          athlete: { is: { deletedAt: null, role: { not: 'ADMIN' } } },
        }),
        expect.objectContaining({
          status: 'ACTIVE',
          respondedAt: expect.any(Date),
        }),
        false,
      );
    });

    it('should reject acceptance by the initiator', async () => {
      repository.findById.mockResolvedValue(pendingRelationship);

      await expect(service.accept(pendingRelationship.id, trainer)).rejects.toThrow(
        ForbiddenException,
      );

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should reject accepting a non-pending relationship', async () => {
      repository.findById.mockResolvedValue(activeRelationship);

      await expect(service.accept(activeRelationship.id, athlete)).rejects.toThrow(
        ConflictException,
      );

      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('decline', () => {
    it('still allows the revoked trainer recipient to decline a pending request', async () => {
      repository.findById.mockResolvedValue({
        ...pendingRelationship,
        initiatedById: athlete.id,
      });
      usersService.findMyCapabilities.mockImplementation(async () => ({
        athlete: true,
        trainer: false,
        admin: false,
      }));
      repository.update.mockResolvedValue({ ...pendingRelationship, status: 'DECLINED' });

      await service.decline(pendingRelationship.id, trainer);

      expect(repository.update).toHaveBeenCalledOnce();
    });

    it('denies a stale session when the participant becomes admin', async () => {
      repository.findById.mockResolvedValue(pendingRelationship);
      usersService.findMyCapabilities.mockResolvedValue({
        athlete: false,
        trainer: false,
        admin: true,
      });

      await expect(service.decline(pendingRelationship.id, athlete)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should allow the recipient to decline a request', async () => {
      repository.findById.mockResolvedValue(pendingRelationship);

      repository.update.mockResolvedValue({
        ...pendingRelationship,
        status: 'DECLINED',
      });

      const result = await service.decline(pendingRelationship.id, athlete);

      expect(result.status).toBe('DECLINED');

      expect(repository.update).toHaveBeenCalledWith(
        {
          id: pendingRelationship.id,
          status: 'PENDING',
        },
        expect.objectContaining({
          status: 'DECLINED',
          respondedAt: expect.any(Date),
        }),
        false,
      );
    });

    it('redacts decline responses for approved ATHLETE-role trainers', async () => {
      const approvedTrainer: TrainerAthleteActor = { id: trainer.id, role: 'ATHLETE' };
      repository.findById.mockResolvedValue({
        ...pendingRelationship,
        initiatedById: athlete.id,
      });
      repository.update.mockResolvedValue({ ...pendingRelationship, status: 'DECLINED' });

      await service.decline(pendingRelationship.id, approvedTrainer);

      expect(repository.update).toHaveBeenCalledWith(
        { id: pendingRelationship.id, status: 'PENDING' },
        expect.objectContaining({ status: 'DECLINED' }),
        true,
      );
    });

    it('should reject decline by the initiator', async () => {
      repository.findById.mockResolvedValue(pendingRelationship);

      await expect(service.decline(pendingRelationship.id, trainer)).rejects.toThrow(
        ForbiddenException,
      );

      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('allows revoked trainer initiator to cancel instead of being stuck pending', async () => {
      repository.findById.mockResolvedValue(pendingRelationship);
      usersService.findMyCapabilities.mockResolvedValue({
        athlete: true,
        trainer: false,
        admin: false,
      });
      repository.update.mockResolvedValue({ ...pendingRelationship, status: 'CANCELLED' });

      await service.cancel(pendingRelationship.id, trainer);

      expect(repository.update).toHaveBeenCalledOnce();
    });

    it('should allow the initiator to cancel a pending request', async () => {
      repository.findById.mockResolvedValue(pendingRelationship);

      repository.update.mockResolvedValue({
        ...pendingRelationship,
        status: 'CANCELLED',
      });

      const result = await service.cancel(pendingRelationship.id, trainer, {
        reason: 'Changed my plans',
      });

      expect(result.status).toBe('CANCELLED');

      expect(repository.update).toHaveBeenCalledWith(
        {
          id: pendingRelationship.id,
          status: 'PENDING',
        },
        expect.objectContaining({
          status: 'CANCELLED',
          endedAt: expect.any(Date),
          endedBy: {
            connect: { id: trainer.id },
          },
          endReason: 'Changed my plans',
        }),
        true,
      );
    });

    it('redacts cancellation responses for approved ATHLETE-role trainers', async () => {
      const approvedTrainer: TrainerAthleteActor = { id: trainer.id, role: 'ATHLETE' };
      repository.findById.mockResolvedValue(pendingRelationship);
      repository.update.mockResolvedValue({ ...pendingRelationship, status: 'CANCELLED' });

      await service.cancel(pendingRelationship.id, approvedTrainer, {});

      expect(repository.update).toHaveBeenCalledWith(
        { id: pendingRelationship.id, status: 'PENDING' },
        expect.objectContaining({ status: 'CANCELLED' }),
        true,
      );
    });

    it('should reject cancellation by the recipient', async () => {
      repository.findById.mockResolvedValue(pendingRelationship);

      await expect(service.cancel(pendingRelationship.id, athlete)).rejects.toThrow(
        ForbiddenException,
      );

      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('terminate', () => {
    it('allows a revoked trainer to terminate an active relationship', async () => {
      repository.findById.mockResolvedValue(activeRelationship);
      usersService.findMyCapabilities.mockResolvedValue({
        athlete: true,
        trainer: false,
        admin: false,
      });
      terminationService.terminateWithExerciseCopies.mockResolvedValue({
        ...activeRelationship,
        status: 'TERMINATED',
      });

      await service.terminate(activeRelationship.id, trainer, {});

      expect(terminationService.terminateWithExerciseCopies).toHaveBeenCalledOnce();
    });

    it('denies termination when the current account is admin', async () => {
      repository.findById.mockResolvedValue(activeRelationship);
      usersService.findMyCapabilities.mockResolvedValue({
        athlete: false,
        trainer: false,
        admin: true,
      });

      await expect(service.terminate(activeRelationship.id, trainer, {})).rejects.toThrow(
        ForbiddenException,
      );
      expect(terminationService.terminateWithExerciseCopies).not.toHaveBeenCalled();
    });

    it('should allow a trainer to terminate an active relationship', async () => {
      repository.findById.mockResolvedValue({
        id: 'relationship-1',
        trainerId: trainer.id,
        athleteId: 'athlete-1',
        initiatedById: trainer.id,
        status: 'ACTIVE',
      });

      terminationService.terminateWithExerciseCopies.mockResolvedValue({
        id: 'relationship-1',
        status: 'TERMINATED',
      });

      const result = await service.terminate('relationship-1', trainer, {
        reason: 'Cooperation ended',
      });

      expect(result.status).toBe('TERMINATED');

      expect(terminationService.terminateWithExerciseCopies).toHaveBeenCalledWith({
        id: 'relationship-1',
        actorId: trainer.id,
        reason: 'Cooperation ended',
        redactForTrainer: true,
      });
    });

    it('should allow an athlete to terminate an active relationship', async () => {
      repository.findById.mockResolvedValue({
        id: 'relationship-1',
        trainerId: trainer.id,
        athleteId: athlete.id,
        initiatedById: trainer.id,
        status: 'ACTIVE',
      });

      terminationService.terminateWithExerciseCopies.mockResolvedValue({
        id: 'relationship-1',
        status: 'TERMINATED',
      });

      const result = await service.terminate('relationship-1', athlete, {
        reason: 'Cooperation ended by athlete',
      });

      expect(result.status).toBe('TERMINATED');

      expect(terminationService.terminateWithExerciseCopies).toHaveBeenCalledWith({
        id: 'relationship-1',
        actorId: athlete.id,
        reason: 'Cooperation ended by athlete',
        redactForTrainer: false,
      });
    });

    it('redacts terminated relationship responses for approved ATHLETE-role trainers', async () => {
      const approvedTrainer: TrainerAthleteActor = { id: trainer.id, role: 'ATHLETE' };
      repository.findById.mockResolvedValue(activeRelationship);
      terminationService.terminateWithExerciseCopies.mockResolvedValue({
        ...activeRelationship,
        status: 'TERMINATED',
      });

      await service.terminate(activeRelationship.id, approvedTrainer, {});

      expect(terminationService.terminateWithExerciseCopies).toHaveBeenCalledWith({
        id: activeRelationship.id,
        actorId: trainer.id,
        reason: undefined,
        redactForTrainer: true,
      });
    });

    it('should reject terminating a pending relationship', async () => {
      repository.findById.mockResolvedValue(pendingRelationship);

      await expect(service.terminate(pendingRelationship.id, trainer, {})).rejects.toThrow(
        ConflictException,
      );

      expect(terminationService.terminateWithExerciseCopies).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('getExerciseAccessContext', () => {
    it('allows an approved ATHLETE to exercise both athlete and trainer access', async () => {
      usersService.findMyCapabilities.mockResolvedValue({
        athlete: true,
        trainer: true,
        admin: false,
      });
      repository.findActiveTrainerIdsForAthlete.mockResolvedValue(['own-trainer']);
      repository.findActiveAthleteIdsForTrainer.mockResolvedValue(['own-athlete']);

      const result = await service.getExerciseAccessContext(athlete);

      expect(result).toEqual({
        activeTrainerIds: ['own-trainer'],
        activeAthleteIds: ['own-athlete'],
      });
      expect(usersService.findMyCapabilities).toHaveBeenCalledExactlyOnceWith(athlete.id);
    });

    it('revokes trainer-side access even with a stale TRAINER session role', async () => {
      usersService.findMyCapabilities.mockResolvedValue({
        athlete: true,
        trainer: false,
        admin: false,
      });
      repository.findActiveTrainerIdsForAthlete.mockResolvedValue(['own-trainer']);

      const result = await service.getExerciseAccessContext(trainer);

      expect(result).toEqual({
        activeTrainerIds: ['own-trainer'],
        activeAthleteIds: [],
      });
      expect(repository.findActiveAthleteIdsForTrainer).not.toHaveBeenCalled();
    });

    it('refuses to query relationships when account capability lookup fails', async () => {
      usersService.findMyCapabilities.mockRejectedValue(new Error('Database unavailable'));

      await expect(service.getExerciseAccessContext(trainer)).rejects.toThrow(
        'Database unavailable',
      );
      expect(repository.findActiveTrainerIdsForAthlete).not.toHaveBeenCalled();
      expect(repository.findActiveAthleteIdsForTrainer).not.toHaveBeenCalled();
    });

    it('should return active trainer IDs for an athlete', async () => {
      repository.findActiveTrainerIdsForAthlete.mockResolvedValue(['trainer-1', 'trainer-2']);

      const result = await service.getExerciseAccessContext(athlete);

      expect(result).toEqual({
        activeTrainerIds: ['trainer-1', 'trainer-2'],
        activeAthleteIds: [],
      });
    });

    it('should return active athlete IDs for a trainer', async () => {
      repository.findActiveAthleteIdsForTrainer.mockResolvedValue(['athlete-1', 'athlete-2']);

      const result = await service.getExerciseAccessContext(trainer);

      expect(result).toEqual({
        activeTrainerIds: [],
        activeAthleteIds: ['athlete-1', 'athlete-2'],
      });
    });

    it('should return an empty context for an admin', async () => {
      const result = await service.getExerciseAccessContext(admin);

      expect(result).toEqual({
        activeTrainerIds: [],
        activeAthleteIds: [],
      });

      expect(repository.findActiveTrainerIdsForAthlete).not.toHaveBeenCalled();

      expect(repository.findActiveAthleteIdsForTrainer).not.toHaveBeenCalled();
    });
  });

  describe('concurrent updates', () => {
    it('should convert Prisma P2025 into ConflictException', async () => {
      repository.findById.mockResolvedValue(pendingRelationship);

      repository.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: '7.10.1',
        }),
      );

      await expect(service.accept(pendingRelationship.id, athlete)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
