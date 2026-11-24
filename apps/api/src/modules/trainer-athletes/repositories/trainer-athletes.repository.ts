import { ConflictException, Injectable } from '@nestjs/common';

import { PrismaService } from '#src/infra/database/index';
import { deriveAccountCapabilities } from '#src/modules/users/public-api';
import {
  InvitationAlreadyExists,
  type CreateInvitationCommand,
} from '../application/create-invitation.js';
import { fullRelationshipReadWhere } from '../policies/trainer-athlete-read.policy.js';
import { Prisma } from '#prisma/client';
import {
  trainerAthleteHistoricalSelect,
  trainerAthleteSelect,
} from '../selects/trainer-athlete.select.js';
import type { FindManyTrainerAthletesParams } from '../types/trainer-athlete.types.js';

@Injectable()
export class TrainerAthletesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // FIND MANY
  async findMany({
    where,
    skip,
    take,
    orderBy = [{ createdAt: 'desc' }, { id: 'desc' }],
  }: FindManyTrainerAthletesParams) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.trainerAthlete.findMany({
        where,
        skip,
        take,
        orderBy,
        select: trainerAthleteSelect,
      }),

      this.prisma.trainerAthlete.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        skip,
        take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  // FIND BY ID
  async findById(id: string, where: Prisma.TrainerAthleteWhereInput = {}) {
    return this.prisma.trainerAthlete.findFirst({
      where: {
        AND: [{ id }, where],
      },
      select: trainerAthleteSelect,
    });
  }

  // FIND OPEN RELATIONSHIP
  async findOpenByPair(trainerId: string, athleteId: string) {
    return this.prisma.trainerAthlete.findFirst({
      where: {
        trainerId,
        athleteId,
        status: {
          in: ['PENDING', 'ACTIVE'],
        },
      },
      select: {
        id: true,
        status: true,
      },
    });
  }

  // CREATE
  async createWithCurrentCapabilities(input: CreateInvitationCommand) {
    try {
      return await this.createInvitationAtomically(input);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new InvitationAlreadyExists();
      }
      throw error;
    }
  }

  private async createInvitationAtomically({
    trainerId,
    athleteId,
    initiatedById,
  }: CreateInvitationCommand) {
    // All validation below takes place while the same PostgreSQL transaction
    // holds locks protecting changes to the relevant account/profile rows.
    // This serializes profile revocation with invitation creation.
    if (trainerId === athleteId || (initiatedById !== trainerId && initiatedById !== athleteId)) {
      throw new ConflictException('Invalid relationship participants');
    }

    return this.prisma.$transaction(async (tx) => {
      // Lock accounts in stable order to avoid deadlocks when two users send
      // invitations simultaneously. FOR UPDATE also blocks FK-backed profile
      // creation until this transaction has committed.
      const ids = [trainerId, athleteId].sort();
      const lockedUsers = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "users"
        WHERE "id" IN (${Prisma.join(ids)})
        ORDER BY "id"
        FOR UPDATE
      `;

      if (lockedUsers.length !== 2) {
        throw new ConflictException('Relationship participants are no longer eligible');
      }

      // User row locks alone do not block updates to an *existing*
      // TrainerProfile. Lock its row too, so is_active cannot change between
      // the capability snapshot and the INSERT. A missing profile remains
      // protected from concurrent creation by the user FK lock above.
      await tx.$queryRaw`
        SELECT "id"
        FROM "trainer_profiles"
        WHERE "user_id" = ${trainerId}
        FOR UPDATE
      `;

      const participants = await tx.user.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: {
          id: true,
          role: true,
          trainerProfile: { select: { isActive: true } },
        },
      });

      const trainer = participants.find((person) => person.id === trainerId);
      const athlete = participants.find((person) => person.id === athleteId);

      if (
        !trainer ||
        !athlete ||
        !deriveAccountCapabilities(trainer).trainer ||
        !deriveAccountCapabilities(athlete).athlete
      ) {
        throw new ConflictException('Relationship participants are no longer eligible');
      }

      return tx.trainerAthlete.create({
        data: {
          trainer: { connect: { id: trainerId } },
          athlete: { connect: { id: athleteId } },
          initiatedBy: { connect: { id: initiatedById } },
        },
        select: trainerAthleteSelect,
      });
    });
  }

  // UPDATE
  async update(
    where: Prisma.TrainerAthleteWhereUniqueInput,
    data: Prisma.TrainerAthleteUpdateInput,
    redactForTrainer = false,
  ) {
    return this.prisma.trainerAthlete.update({
      where,
      data,
      select: redactForTrainer ? trainerAthleteHistoricalSelect : trainerAthleteSelect,
    });
  }

  // ACTIVE TRAINERS FOR ATHLETE
  async findActiveTrainerIdsForAthlete(athleteId: string): Promise<string[]> {
    const relationships = await this.prisma.trainerAthlete.findMany({
      where: {
        athleteId,
        status: 'ACTIVE',
      },
      select: {
        trainerId: true,
      },
    });

    return relationships.map((item) => item.trainerId);
  }

  // ACTIVE ATHLETES FOR TRAINER
  async findActiveAthleteIdsForTrainer(trainerId: string): Promise<string[]> {
    const relationships = await this.prisma.trainerAthlete.findMany({
      where: {
        trainerId,
        status: 'ACTIVE',
      },
      select: {
        athleteId: true,
      },
    });

    return relationships.map((item) => item.athleteId);
  }

  /**
   * Safe mixed-role history: every page is loaded with the restricted
   * projection first, then full details are fetched only while the
   * relationship is open or the current user is its athlete.
   */
  async findManyForParticipant(
    {
      where,
      skip,
      take,
      orderBy = [{ createdAt: 'desc' }, { id: 'desc' }],
    }: FindManyTrainerAthletesParams,
    actorId: string,
    hasTrainerCapability: boolean,
  ) {
    const [historical, total] = await this.prisma.$transaction([
      this.prisma.trainerAthlete.findMany({
        where,
        skip,
        take,
        orderBy,
        select: trainerAthleteHistoricalSelect,
      }),
      this.prisma.trainerAthlete.count({ where }),
    ]);

    const fullIds = historical
      .filter(
        (item) =>
          item.athleteId === actorId ||
          (hasTrainerCapability && (item.status === 'ACTIVE' || item.status === 'PENDING')),
      )
      .map((item) => item.id);

    const fullRelationships = fullIds.length
      ? await this.prisma.trainerAthlete.findMany({
          where: {
            AND: [
              where,
              {
                id: { in: fullIds },
                ...fullRelationshipReadWhere(actorId, hasTrainerCapability),
              },
            ],
          },
          select: trainerAthleteSelect,
        })
      : [];

    const fullById = new Map(fullRelationships.map((item) => [item.id, item]));

    return {
      data: historical.map((item) => fullById.get(item.id) ?? item),
      meta: {
        total,
        skip,
        take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async findRestrictedById(id: string, where: Prisma.TrainerAthleteWhereInput) {
    return this.prisma.trainerAthlete.findFirst({
      where: { AND: [{ id }, where] },
      select: trainerAthleteHistoricalSelect,
    });
  }
}
