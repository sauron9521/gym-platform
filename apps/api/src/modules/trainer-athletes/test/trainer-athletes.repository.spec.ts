import { ConflictException } from '@nestjs/common';

import { PrismaService } from '#src/infra/database/index';
import { Prisma } from '#prisma/client';

import { InvitationAlreadyExists } from '../application/create-invitation.js';
import { PendingInvitationConflict } from '../application/pending-invitation-transition.js';
import { TrainerAthletesRepository } from '../repositories/trainer-athletes.repository.js';
import { fullRelationshipReadWhere } from '../policies/trainer-athlete-read.policy.js';
import {
  trainerAthleteHistoricalSelect,
  trainerAthleteSelect,
} from '../selects/trainer-athlete.select.js';

describe('TrainerAthletesRepository', () => {
  let repository: TrainerAthletesRepository;

  const prisma = {
    $transaction: vi.fn(),

    trainerAthlete: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();

    repository = new TrainerAthletesRepository(prisma as unknown as PrismaService);
  });

  describe('findMany', () => {
    it('should return relationships with pagination metadata', async () => {
      const relationships = [
        {
          id: 'relationship-1',
          trainerId: 'trainer-1',
          athleteId: 'athlete-1',
          status: 'ACTIVE',
        },
      ];

      const where = {
        trainerId: 'trainer-1',
        status: 'ACTIVE',
      } satisfies Prisma.TrainerAthleteWhereInput;

      prisma.$transaction.mockResolvedValue([relationships, 12]);

      const result = await repository.findMany({
        where,
        skip: 10,
        take: 5,
      });

      expect(prisma.trainerAthlete.findMany).toHaveBeenCalledWith({
        where,
        skip: 10,
        take: 5,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: trainerAthleteSelect,
      });

      expect(prisma.trainerAthlete.count).toHaveBeenCalledWith({
        where,
      });

      expect(prisma.$transaction).toHaveBeenCalledOnce();

      expect(result).toEqual({
        data: relationships,
        meta: {
          total: 12,
          skip: 10,
          take: 5,
          totalPages: 3,
        },
      });
    });

    it('should use custom ordering when provided', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findMany({
        where: { athleteId: 'athlete-1' },
        skip: 0,
        take: 10,
        orderBy: [{ status: 'asc' }],
      });

      expect(prisma.trainerAthlete.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ status: 'asc' }],
        }),
      );
    });

    it('should return empty results when no relationships exist', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);

      const result = await repository.findMany({
        where: { trainerId: 'trainer-1' },
        skip: 0,
        take: 10,
      });

      expect(result).toEqual({
        data: [],
        meta: {
          total: 0,
          skip: 0,
          take: 10,
          totalPages: 0,
        },
      });
    });
  });

  describe('findManyForParticipant', () => {
    it('never requeries open trainer contact fields after capability revocation', async () => {
      prisma.$transaction.mockResolvedValue([
        [
          { id: 'open', trainerId: 'trainer-1', athleteId: 'athlete-1', status: 'ACTIVE' },
          { id: 'pending', trainerId: 'trainer-1', athleteId: 'athlete-2', status: 'PENDING' },
        ],
        2,
      ]);

      const result = await repository.findManyForParticipant(
        { where: { trainerId: 'trainer-1' }, skip: 0, take: 20 },
        'trainer-1',
        false,
      );

      expect(result.data).toHaveLength(2);
      expect(prisma.trainerAthlete.findMany).toHaveBeenCalledTimes(1);
    });

    it('restricts the second SQL query to the current athlete side after revocation', async () => {
      const actorId = 'dual-user';
      const where = { OR: [{ trainerId: actorId }, { athleteId: actorId }] };
      prisma.$transaction.mockResolvedValue([
        [
          { id: 'former-trainer-open', trainerId: actorId, athleteId: 'other', status: 'ACTIVE' },
          {
            id: 'own-athlete-history',
            trainerId: 'trainer-2',
            athleteId: actorId,
            status: 'TERMINATED',
          },
        ],
        2,
      ]);
      prisma.trainerAthlete.findMany.mockResolvedValue([
        { id: 'own-athlete-history', athleteId: actorId, status: 'TERMINATED' },
      ]);

      await repository.findManyForParticipant({ where, skip: 0, take: 10 }, actorId, false);

      expect(prisma.trainerAthlete.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          AND: [
            where,
            {
              id: { in: ['own-athlete-history'] },
              ...fullRelationshipReadWhere(actorId, false),
            },
          ],
        },
        select: trainerAthleteSelect,
      });
    });

    it('redacts trainer history but preserves athlete and open records', async () => {
      const actorId = 'dual-user';
      const where = {
        OR: [{ trainerId: actorId }, { athleteId: actorId }],
      } satisfies Prisma.TrainerAthleteWhereInput;
      const restricted = [
        {
          id: 'trainer-history',
          trainerId: actorId,
          athleteId: 'athlete-1',
          status: 'TERMINATED',
          athlete: { id: 'athlete-1' },
        },
        {
          id: 'athlete-history',
          trainerId: 'other-trainer',
          athleteId: actorId,
          status: 'TERMINATED',
          athlete: { id: actorId },
        },
        {
          id: 'open-relationship',
          trainerId: actorId,
          athleteId: 'athlete-2',
          status: 'ACTIVE',
          athlete: { id: 'athlete-2' },
        },
      ];
      prisma.$transaction.mockResolvedValue([restricted, 3]);
      prisma.trainerAthlete.findMany.mockResolvedValue([
        {
          ...restricted[1],
          athlete: { id: actorId, email: 'me@example.com' },
        },
        {
          ...restricted[2],
          athlete: { id: 'athlete-2', email: 'active@example.com' },
        },
      ]);

      const result = await repository.findManyForParticipant(
        { where, skip: 0, take: 10 },
        actorId,
        true,
      );

      expect(result.data[0]).toEqual(restricted[0]);
      expect(result.data[0]?.athlete).not.toHaveProperty('email');
      expect(result.data[1]?.athlete).toHaveProperty('email', 'me@example.com');
      expect(result.data[2]?.athlete).toHaveProperty('email', 'active@example.com');
      expect(result.meta).toEqual({ total: 3, skip: 0, take: 10, totalPages: 1 });

      expect(prisma.trainerAthlete.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          AND: [
            where,
            {
              id: { in: ['athlete-history', 'open-relationship'] },
              ...fullRelationshipReadWhere(actorId, true),
            },
          ],
        },
        select: expect.any(Object),
      });
    });

    it('does not requery contact fields for only historical trainer-side records', async () => {
      prisma.$transaction.mockResolvedValue([
        [{ id: 'former', trainerId: 'trainer-1', athleteId: 'athlete-1', status: 'DECLINED' }],
        1,
      ]);
      const result = await repository.findManyForParticipant(
        { where: { trainerId: 'trainer-1' }, skip: 0, take: 20 },
        'trainer-1',
        true,
      );

      expect(result.data).toHaveLength(1);
      expect(prisma.trainerAthlete.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('findRestrictedById', () => {
    it('keeps only the restricted projection for open or ended relationships', async () => {
      prisma.trainerAthlete.findFirst.mockResolvedValue({
        id: 'active-relationship',
        status: 'ACTIVE',
      });

      const result = await repository.findRestrictedById('active-relationship', {
        trainerId: 'trainer-1',
      });

      expect(result).toMatchObject({ status: 'ACTIVE' });
      expect(prisma.trainerAthlete.findFirst).toHaveBeenCalledWith({
        where: {
          AND: [{ id: 'active-relationship' }, { trainerId: 'trainer-1' }],
        },
        select: trainerAthleteHistoricalSelect,
      });
    });
  });

  describe('findById', () => {
    it('should return a relationship by ID with conditions', async () => {
      const relationship = {
        id: 'relationship-1',
        trainerId: 'trainer-1',
        athleteId: 'athlete-1',
        status: 'ACTIVE',
      };

      prisma.trainerAthlete.findFirst.mockResolvedValue(relationship);

      const result = await repository.findById('relationship-1', {
        trainerId: 'trainer-1',
        status: 'ACTIVE',
      });

      expect(prisma.trainerAthlete.findFirst).toHaveBeenCalledWith({
        where: {
          AND: [
            { id: 'relationship-1' },
            {
              trainerId: 'trainer-1',
              status: 'ACTIVE',
            },
          ],
        },
        select: trainerAthleteSelect,
      });

      expect(result).toEqual(relationship);
    });

    it('should return null when relationship does not exist', async () => {
      prisma.trainerAthlete.findFirst.mockResolvedValue(null);

      const result = await repository.findById('missing-id');

      expect(result).toBeNull();
    });
  });

  describe('findOpenByPair', () => {
    it('should find a pending or active relationship', async () => {
      const relationship = {
        id: 'relationship-1',
        status: 'ACTIVE',
      };

      prisma.trainerAthlete.findFirst.mockResolvedValue(relationship);

      const result = await repository.findOpenByPair('trainer-1', 'athlete-1');

      expect(prisma.trainerAthlete.findFirst).toHaveBeenCalledWith({
        where: {
          trainerId: 'trainer-1',
          athleteId: 'athlete-1',
          status: {
            in: ['PENDING', 'ACTIVE'],
          },
        },
        select: {
          id: true,
          status: true,
        },
      });

      expect(result).toEqual(relationship);
    });

    it('should return null when no open relationship exists', async () => {
      prisma.trainerAthlete.findFirst.mockResolvedValue(null);

      const result = await repository.findOpenByPair('trainer-1', 'athlete-1');

      expect(result).toBeNull();
    });
  });

  describe('createWithCurrentCapabilities', () => {
    const invitation = {
      trainerId: 'trainer-1',
      athleteId: 'athlete-1',
      initiatedById: 'trainer-1',
    };

    const trainer = { id: 'trainer-1', role: 'TRAINER', trainerProfile: null };
    const athlete = { id: 'athlete-1', role: 'ATHLETE', trainerProfile: null };

    const tx = {
      $queryRaw: vi.fn(),
      user: { findMany: vi.fn() },
      trainerAthlete: { create: vi.fn() },
    };

    beforeEach(() => {
      vi.resetAllMocks();
      tx.$queryRaw.mockResolvedValueOnce([{ id: 'athlete-1' }, { id: 'trainer-1' }]);
      tx.$queryRaw.mockResolvedValueOnce([{ id: 'profile-1' }]);
      tx.user.findMany.mockResolvedValue([trainer, athlete]);
      tx.trainerAthlete.create.mockResolvedValue({
        id: 'relationship-1',
        ...invitation,
        status: 'PENDING',
      });
      prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    });

    it('locks both users and the trainer profile before inserting', async () => {
      const result = await repository.createWithCurrentCapabilities(invitation);

      expect(result).toMatchObject({ status: 'PENDING', ...invitation });
      expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
      expect(tx.$queryRaw.mock.calls[0]?.[0].join('')).toContain('FOR UPDATE');
      expect(tx.$queryRaw.mock.calls[0]?.[1].values).toEqual(['athlete-1', 'trainer-1']);
      expect(tx.$queryRaw.mock.calls[1]?.[0].join('')).toContain('"trainer_profiles"');
      expect(tx.$queryRaw.mock.calls[1]?.[0].join('')).toContain('FOR UPDATE');
      expect(tx.$queryRaw.mock.calls[1]?.[1]).toBe('trainer-1');
      expect(tx.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['athlete-1', 'trainer-1'] }, deletedAt: null },
        select: {
          id: true,
          role: true,
          trainerProfile: { select: { isActive: true } },
        },
      });
      expect(tx.trainerAthlete.create).toHaveBeenCalledWith({
        data: {
          trainer: { connect: { id: 'trainer-1' } },
          athlete: { connect: { id: 'athlete-1' } },
          initiatedBy: { connect: { id: 'trainer-1' } },
        },
        select: trainerAthleteSelect,
      });
    });

    it('supports an approved ATHLETE-role trainer', async () => {
      tx.user.findMany.mockResolvedValue([
        { ...trainer, role: 'ATHLETE', trainerProfile: { isActive: true } },
        athlete,
      ]);

      await expect(repository.createWithCurrentCapabilities(invitation)).resolves.toMatchObject({
        status: 'PENDING',
      });
    });

    it('refuses to insert when an existing TrainerProfile is revoked', async () => {
      tx.user.findMany.mockResolvedValue([
        { ...trainer, trainerProfile: { isActive: false } },
        athlete,
      ]);

      await expect(repository.createWithCurrentCapabilities(invitation)).rejects.toThrow(
        ConflictException,
      );
      expect(tx.trainerAthlete.create).not.toHaveBeenCalled();
    });

    it('rejects the athlete becoming admin between preflight and transaction', async () => {
      tx.user.findMany.mockResolvedValue([trainer, { ...athlete, role: 'ADMIN' }]);

      await expect(repository.createWithCurrentCapabilities(invitation)).rejects.toThrow(
        ConflictException,
      );
      expect(tx.trainerAthlete.create).not.toHaveBeenCalled();
    });

    it('rejects missing or soft-deleted participants', async () => {
      tx.user.findMany.mockResolvedValue([trainer]);

      await expect(repository.createWithCurrentCapabilities(invitation)).rejects.toThrow(
        ConflictException,
      );
      expect(tx.trainerAthlete.create).not.toHaveBeenCalled();
    });

    it('rejects a missing account lock before querying the profile', async () => {
      tx.$queryRaw.mockReset();
      tx.$queryRaw.mockResolvedValueOnce([{ id: 'trainer-1' }]);

      await expect(repository.createWithCurrentCapabilities(invitation)).rejects.toThrow(
        ConflictException,
      );
      expect(tx.$queryRaw).toHaveBeenCalledOnce();
      expect(tx.trainerAthlete.create).not.toHaveBeenCalled();
    });

    it('rolls back rather than bypassing the guard on a DB error', async () => {
      const error = new Error('Database unavailable');
      tx.$queryRaw.mockReset();
      tx.$queryRaw.mockRejectedValueOnce(error);

      await expect(repository.createWithCurrentCapabilities(invitation)).rejects.toBe(error);
      expect(tx.trainerAthlete.create).not.toHaveBeenCalled();
    });

    it('translates duplicate invitation writes after the transaction rejects', async () => {
      tx.trainerAthlete.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.10.1',
        }),
      );

      await expect(repository.createWithCurrentCapabilities(invitation)).rejects.toBeInstanceOf(
        InvitationAlreadyExists,
      );
      expect(tx.trainerAthlete.create).toHaveBeenCalledOnce();
    });

    it('preserves unrelated Prisma transaction failures', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Transaction conflict', {
        code: 'P2034',
        clientVersion: '7.10.1',
      });
      prisma.$transaction.mockRejectedValueOnce(error);

      await expect(repository.createWithCurrentCapabilities(invitation)).rejects.toBe(error);
    });

    it('prevents malformed requests from writing a non-participant initiator', async () => {
      await expect(
        repository.createWithCurrentCapabilities({ ...invitation, initiatedById: 'outsider' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('acceptPendingInvitation', () => {
    const command = {
      relationshipId: 'relationship-1',
      respondedAt: new Date('2026-11-01T10:00:00.000Z'),
    };

    it('requires a pending invitation and current participant eligibility in the update', async () => {
      const accepted = { id: command.relationshipId, status: 'ACTIVE' };
      prisma.trainerAthlete.update.mockResolvedValueOnce(accepted);

      await expect(repository.acceptPendingInvitation(command)).resolves.toBe(accepted);

      expect(prisma.trainerAthlete.update).toHaveBeenCalledExactlyOnceWith({
        where: {
          id: command.relationshipId,
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
        },
        data: { status: 'ACTIVE', respondedAt: command.respondedAt },
        select: trainerAthleteSelect,
      });
    });

    it('translates a failed conditional write to an acceptance conflict', async () => {
      prisma.trainerAthlete.update.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: '7.10.1',
        }),
      );

      await expect(repository.acceptPendingInvitation(command)).rejects.toBeInstanceOf(
        PendingInvitationConflict,
      );
    });

    it('preserves unrelated Prisma failures', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Transaction conflict', {
        code: 'P2034',
        clientVersion: '7.10.1',
      });
      prisma.trainerAthlete.update.mockRejectedValueOnce(error);

      await expect(repository.acceptPendingInvitation(command)).rejects.toBe(error);
    });
  });

  describe('closePendingInvitation', () => {
    const relationshipId = 'relationship-1';
    const timestamp = new Date('2026-11-01T10:00:00.000Z');

    it('records a decline response on a pending invitation with the athlete projection', async () => {
      const declined = { id: relationshipId, status: 'DECLINED' };
      prisma.trainerAthlete.update.mockResolvedValueOnce(declined);

      await expect(
        repository.closePendingInvitation({
          relationshipId,
          status: 'DECLINED',
          respondedAt: timestamp,
          redactForTrainer: false,
        }),
      ).resolves.toBe(declined);

      expect(prisma.trainerAthlete.update).toHaveBeenCalledExactlyOnceWith({
        where: { id: relationshipId, status: 'PENDING' },
        data: { status: 'DECLINED', respondedAt: timestamp },
        select: trainerAthleteSelect,
      });
    });

    it('records cancellation on a pending invitation with the restricted trainer projection', async () => {
      const cancelled = { id: relationshipId, status: 'CANCELLED' };
      prisma.trainerAthlete.update.mockResolvedValueOnce(cancelled);

      await expect(
        repository.closePendingInvitation({
          relationshipId,
          status: 'CANCELLED',
          endedAt: timestamp,
          endedById: 'trainer-1',
          endReason: 'Changed my plans',
          redactForTrainer: true,
        }),
      ).resolves.toBe(cancelled);

      expect(prisma.trainerAthlete.update).toHaveBeenCalledExactlyOnceWith({
        where: { id: relationshipId, status: 'PENDING' },
        data: {
          status: 'CANCELLED',
          endedAt: timestamp,
          endedBy: { connect: { id: 'trainer-1' } },
          endReason: 'Changed my plans',
        },
        select: trainerAthleteHistoricalSelect,
      });
    });
  });

  describe('findActiveTrainerIdsForAthlete', () => {
    it('should return IDs of active trainers', async () => {
      prisma.trainerAthlete.findMany.mockResolvedValue([
        { trainerId: 'trainer-1' },
        { trainerId: 'trainer-2' },
      ]);

      const result = await repository.findActiveTrainerIdsForAthlete('athlete-1');

      expect(prisma.trainerAthlete.findMany).toHaveBeenCalledWith({
        where: {
          athleteId: 'athlete-1',
          status: 'ACTIVE',
        },
        select: {
          trainerId: true,
        },
      });

      expect(result).toEqual(['trainer-1', 'trainer-2']);
    });

    it('should return an empty array when no active trainers exist', async () => {
      prisma.trainerAthlete.findMany.mockResolvedValue([]);

      const result = await repository.findActiveTrainerIdsForAthlete('athlete-1');

      expect(result).toEqual([]);
    });
  });

  describe('findActiveAthleteIdsForTrainer', () => {
    it('should return IDs of active athletes', async () => {
      prisma.trainerAthlete.findMany.mockResolvedValue([
        { athleteId: 'athlete-1' },
        { athleteId: 'athlete-2' },
      ]);

      const result = await repository.findActiveAthleteIdsForTrainer('trainer-1');

      expect(prisma.trainerAthlete.findMany).toHaveBeenCalledWith({
        where: {
          trainerId: 'trainer-1',
          status: 'ACTIVE',
        },
        select: {
          athleteId: true,
        },
      });

      expect(result).toEqual(['athlete-1', 'athlete-2']);
    });

    it('should return an empty array when no active athletes exist', async () => {
      prisma.trainerAthlete.findMany.mockResolvedValue([]);

      const result = await repository.findActiveAthleteIdsForTrainer('trainer-1');

      expect(result).toEqual([]);
    });
  });
});
