import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '#prisma/client';

import { UsersService } from '#src/modules/users/services/users.service';
import { fullRelationshipReadWhere } from '../policies/trainer-athlete-read.policy.js';
import { TrainerAthletesRepository } from '../repositories/trainer-athletes.repository.js';
import { TrainerAthleteTerminationService } from './trainer-athlete-termination.service.js';

import type { ExerciseAccessContext } from '#src/modules/exercises/types/exercise.types';

import type {
  CreateTrainerAthleteInput,
  TerminateTrainerAthleteInput,
  TrainerAthleteActor,
  TrainerAthleteListQuery,
} from '../types/trainer-athlete.types.js';

@Injectable()
export class TrainerAthletesService {
  constructor(
    private readonly trainerAthletesRepository: TrainerAthletesRepository,
    private readonly terminationService: TrainerAthleteTerminationService,
    private readonly usersService: UsersService,
  ) {}

  // CREATE REQUEST
  async create(actor: TrainerAthleteActor, input: CreateTrainerAthleteInput) {
    if (actor.id === input.userId) {
      throw new BadRequestException('You cannot create a relationship with yourself');
    }

    // Read both current DB capabilities: a JWT role or a public client flag
    // must never grant trainer privileges after approval is revoked.
    const actorCapabilities = await this.usersService.findMyCapabilities(actor.id);
    if (!actorCapabilities.athlete || actorCapabilities.admin) {
      throw new ForbiddenException('Only athletes and active trainers can invite participants');
    }
    const targetCapabilities = await this.usersService.findMyCapabilities(input.userId);

    const trainerInvitesAthlete = actorCapabilities.trainer && targetCapabilities.athlete;
    const athleteInvitesTrainer = actorCapabilities.athlete && targetCapabilities.trainer;

    // This endpoint only carries userId, not the intended relationship roles.
    // When both people have Trainer capability, avoid silently reversing the
    // invitation or granting an unintended trainer-to-athlete relationship.
    if (trainerInvitesAthlete && athleteInvitesTrainer) {
      throw new BadRequestException('Invitation roles are ambiguous');
    }
    if (!trainerInvitesAthlete && !athleteInvitesTrainer) {
      throw new BadRequestException('An athlete and an active trainer are required');
    }

    const trainerId = trainerInvitesAthlete ? actor.id : input.userId;
    const athleteId = trainerInvitesAthlete ? input.userId : actor.id;

    const existing = await this.trainerAthletesRepository.findOpenByPair(trainerId, athleteId);

    if (existing) {
      throw new ConflictException('An active or pending relationship already exists');
    }

    try {
      // Preflight checks above provide clear API errors, but must not be
      // authoritative: moderation can revoke a TrainerProfile before INSERT.
      return await this.trainerAthletesRepository.createWithCurrentCapabilities({
        trainerId,
        athleteId,
        initiatedById: actor.id,
      });
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('An active or pending relationship already exists');
      }

      throw error;
    }
  }

  // FIND MANY
  async findMany(actor: TrainerAthleteActor, query: TrainerAthleteListQuery) {
    const capabilities = await this.assertCurrentParticipant(actor);
    this.validatePagination(query);

    // Trainer-only read mode is required for accurate dashboard pagination.
    // A person can simultaneously be an athlete under another trainer, so
    // pagination must be scoped in PostgreSQL, never filtered after the fact.
    if (query.scope === 'trainer' && !capabilities.trainer) {
      throw new ForbiddenException('Current trainer approval is required');
    }

    const where: Prisma.TrainerAthleteWhereInput = {
      ...(query.scope === 'trainer'
        ? { trainerId: actor.id }
        : { OR: [{ trainerId: actor.id }, { athleteId: actor.id }] }),
      ...(query.status ? { status: query.status } : {}),
    };

    const params = {
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    };

    // Redact ended trainer-side relationships based on relationship ownership,
    // regardless of a user's legacy TRAINER/ATHLETE session role.
    return this.trainerAthletesRepository.findManyForParticipant(
      params,
      actor.id,
      capabilities.trainer,
    );
  }

  // FIND ONE
  async findOne(id: string, actor: TrainerAthleteActor) {
    const capabilities = await this.assertCurrentParticipant(actor);

    const fullRelationship = await this.trainerAthletesRepository.findById(
      id,
      fullRelationshipReadWhere(actor.id, capabilities.trainer),
    );

    if (fullRelationship) {
      return fullRelationship;
    }

    // A revoked trainer must still be able to view the minimal relationship
    // state needed to decline, cancel, or terminate it, without contact fields.
    // This applies to PENDING / ACTIVE as well as historical relationships.
    const restricted = await this.trainerAthletesRepository.findRestrictedById(id, {
      trainerId: actor.id,
    });

    if (!restricted) {
      throw new NotFoundException('Relationship not found');
    }

    return restricted;
  }

  // ACCEPT REQUEST
  async accept(id: string, actor: TrainerAthleteActor) {
    const relationship = await this.findOne(id, actor);

    this.assertRecipient(relationship, actor);
    this.assertStatus(relationship.status, 'PENDING');
    await this.assertCanAccept(actor, relationship);

    return this.updateWithConflictHandling(
      {
        id,
        status: 'PENDING',
        // Fail closed if moderation revokes TrainerProfile between the
        // capability lookup and the conditional PostgreSQL update.
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
        athlete: {
          is: { deletedAt: null, role: { not: 'ADMIN' } },
        },
      },
      {
        status: 'ACTIVE',
        respondedAt: new Date(),
      },
    );
  }

  // DECLINE REQUEST
  async decline(id: string, actor: TrainerAthleteActor) {
    const relationship = await this.findOne(id, actor);

    this.assertRecipient(relationship, actor);
    this.assertStatus(relationship.status, 'PENDING');
    await this.assertCurrentParticipant(actor);

    return this.updateWithConflictHandling(
      {
        id,
        status: 'PENDING',
      },
      {
        status: 'DECLINED',
        respondedAt: new Date(),
      },
      relationship.trainerId === actor.id,
    );
  }

  // CANCEL REQUEST
  async cancel(id: string, actor: TrainerAthleteActor, input: TerminateTrainerAthleteInput = {}) {
    const relationship = await this.findOne(id, actor);

    if (relationship.initiatedById !== actor.id) {
      throw new ForbiddenException('Only the request initiator can cancel it');
    }

    this.assertStatus(relationship.status, 'PENDING');
    await this.assertCurrentParticipant(actor);

    return this.updateWithConflictHandling(
      {
        id,
        status: 'PENDING',
      },
      {
        status: 'CANCELLED',
        endedAt: new Date(),
        endedBy: {
          connect: { id: actor.id },
        },
        endReason: input.reason ?? null,
      },
      relationship.trainerId === actor.id,
    );
  }

  // TERMINATE ACTIVE RELATIONSHIP
  async terminate(id: string, actor: TrainerAthleteActor, input: TerminateTrainerAthleteInput) {
    const relationship = await this.findOne(id, actor);

    this.assertStatus(relationship.status, 'ACTIVE');
    // A revoked trainer must still be able to end a collaboration safely.
    await this.assertCurrentParticipant(actor);

    const terminated = await this.terminationService.terminateWithExerciseCopies({
      id,
      actorId: actor.id,
      reason: input.reason,
      redactForTrainer: relationship.trainerId === actor.id,
    });

    if (!terminated) {
      throw new ConflictException('Relationship state has changed. Reload and try again.');
    }

    return terminated;
  }

  // EXERCISE ACCESS CONTEXT
  async getExerciseAccessContext(actor: TrainerAthleteActor): Promise<ExerciseAccessContext> {
    // Trust the current persisted account, never the role captured in a session.
    // An approved trainer can also be an athlete; a revoked trainer cannot read
    // athlete-owned exercises through previously active trainer relationships.
    const capabilities = await this.usersService.findMyCapabilities(actor.id);

    const activeTrainerIds = capabilities.athlete
      ? await this.trainerAthletesRepository.findActiveTrainerIdsForAthlete(actor.id)
      : [];
    const activeAthleteIds = capabilities.trainer
      ? await this.trainerAthletesRepository.findActiveAthleteIdsForTrainer(actor.id)
      : [];

    return { activeTrainerIds, activeAthleteIds };
  }

  // HELPERS
  private async assertCurrentParticipant(actor: TrainerAthleteActor) {
    const capabilities = await this.usersService.findMyCapabilities(actor.id);
    if (!capabilities.athlete || capabilities.admin) {
      throw new ForbiddenException('Only active participants can manage relationships');
    }

    return capabilities;
  }

  private async assertCanAccept(
    actor: TrainerAthleteActor,
    relationship: { trainerId: string; athleteId: string },
  ) {
    const current = await this.assertCurrentParticipant(actor);
    const trainer =
      relationship.trainerId === actor.id
        ? current
        : await this.usersService.findMyCapabilities(relationship.trainerId);
    const athlete =
      relationship.athleteId === actor.id
        ? current
        : await this.usersService.findMyCapabilities(relationship.athleteId);

    if (!trainer.trainer || !athlete.athlete) {
      throw new ConflictException('Relationship participants are no longer eligible');
    }
  }

  private assertRecipient(
    relationship: {
      initiatedById: string;
    },
    actor: TrainerAthleteActor,
  ): void {
    if (relationship.initiatedById === actor.id) {
      throw new ForbiddenException('The request initiator cannot respond to their own request');
    }
  }

  private assertStatus(currentStatus: string, expectedStatus: string): void {
    if (currentStatus !== expectedStatus) {
      throw new ConflictException(`Relationship must be ${expectedStatus.toLowerCase()}`);
    }
  }

  private validatePagination(query: TrainerAthleteListQuery): void {
    if (
      !Number.isInteger(query.page) ||
      query.page < 1 ||
      !Number.isInteger(query.limit) ||
      query.limit < 1 ||
      query.limit > 100
    ) {
      throw new BadRequestException('Invalid pagination parameters');
    }
  }

  private async updateWithConflictHandling(
    where: Prisma.TrainerAthleteWhereUniqueInput,
    data: Prisma.TrainerAthleteUpdateInput,
    redactForTrainer = false,
  ) {
    try {
      return await this.trainerAthletesRepository.update(where, data, redactForTrainer);
    } catch (error) {
      if (this.isPrismaError(error, 'P2025')) {
        throw new ConflictException('Relationship state has changed. Reload and try again.');
      }

      throw error;
    }
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  }
}
