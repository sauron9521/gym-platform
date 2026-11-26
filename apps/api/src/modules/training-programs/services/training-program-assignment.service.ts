import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AssignmentCancellationStateChanged } from '../application/assignment-cancellation.js';
import { AssignmentCreationError } from '../application/assignment-creation.js';

import { TrainerAthletesService } from '#src/modules/trainer-athletes/public-api';

import {
  assignmentFullReadWhere,
  assignmentParticipantWhere,
} from '../policies/training-program-assignment-read.policy.js';

import { TrainingProgramAssignmentRepository } from '../repositories/training-program-assignment.repository.js';
import { TrainingProgramAccessService } from './training-program-access.service.js';
import { TrainingProgramCrudService } from './training-program-crud.service.js';
import { TrainingProgramVersionService } from './training-program-version.service.js';

import type {
  CancelTrainingProgramAssignmentInput,
  CreateTrainingProgramAssignmentInput,
  TrainingProgramActor,
  TrainingProgramAssignmentListQuery,
} from '../types/training-program.types.js';

@Injectable()
export class TrainingProgramAssignmentService {
  constructor(
    private readonly repository: TrainingProgramAssignmentRepository,
    private readonly crudService: TrainingProgramCrudService,
    private readonly versionService: TrainingProgramVersionService,
    private readonly accessService: TrainingProgramAccessService,
    private readonly trainerAthletesService: TrainerAthletesService,
  ) {}

  async assignVersionToAthlete(
    actor: TrainingProgramActor,
    programId: string,
    versionId: string,
    input: CreateTrainingProgramAssignmentInput,
  ) {
    await this.accessService.assertTrainer(actor);

    const program = await this.crudService.findOne(programId, actor);

    if (program.status === 'ARCHIVED') {
      throw new ConflictException('Archived programs cannot be assigned.');
    }

    const version = await this.versionService.findVersion(programId, versionId, actor);

    if (version.status !== 'PUBLISHED') {
      throw new ConflictException('Only published versions can be assigned.');
    }

    const relationship = await this.trainerAthletesService.findOne(input.trainerAthleteId, actor);

    if (relationship.trainerId !== actor.id) {
      throw new ForbiddenException('You can only assign programs to your own athletes.');
    }

    if (relationship.status !== 'ACTIVE') {
      throw new ConflictException('An active trainer-athlete relationship is required.');
    }

    let assignment: Awaited<
      ReturnType<TrainingProgramAssignmentRepository['createAssignmentForActiveRelationship']>
    >;

    try {
      assignment = await this.repository.createAssignmentForActiveRelationship({
        programId,
        versionId,
        trainerAthleteId: relationship.id,
        trainerId: actor.id,
        athleteId: relationship.athleteId,
      });
    } catch (error) {
      if (error instanceof AssignmentCreationError) {
        if (error.code === 'REFERENCE_MISSING') {
          throw new NotFoundException(error.message);
        }
        throw new ConflictException(error.message);
      }

      throw error;
    }

    if (!assignment) {
      throw new ConflictException(
        'Program, version or trainer-athlete relationship is no longer eligible for assignment. Reload and try again.',
      );
    }

    return assignment;
  }

  async findManyAssignments(
    actor: TrainingProgramActor,
    query: TrainingProgramAssignmentListQuery,
  ) {
    await this.accessService.assertAssignmentParticipant(actor);
    this.validateAssignmentPagination(query);

    // Opt-in trainer client detail: never apply the relationship filter after
    // participant-wide pagination, which would return incorrect totals/pages.
    if (query.trainerAthleteId) {
      if (query.view !== 'summary') {
        throw new BadRequestException('Filtered trainer assignment lists require summary view.');
      }
      await this.accessService.assertTrainer(actor);
      const relationship = await this.trainerAthletesService.findOne(query.trainerAthleteId, actor);
      if (relationship.trainerId !== actor.id || relationship.status !== 'ACTIVE') {
        // Foreign, missing, pending and ended relations are indistinguishable.
        throw new NotFoundException('Active trainer client not found.');
      }

      const params = {
        where: {
          AND: [
            { trainerAthleteId: query.trainerAthleteId },
            {
              trainerAthlete: {
                is: {
                  id: query.trainerAthleteId,
                  trainerId: actor.id,
                  status: 'ACTIVE' as const,
                },
              },
            },
            { version: { program: { trainerId: actor.id } } },
            // Authorization is checked again in both DB queries, not only
            // against stale session roles or the initial relationship read.
            assignmentFullReadWhere(actor.id),
            ...(query.status ? [{ status: query.status }] : []),
          ],
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        view: 'summary' as const,
      } satisfies Parameters<TrainingProgramAssignmentRepository['findManyAssignments']>[0];

      return this.repository.findManyAssignments(params);
    }

    // Historical participant list semantics (including an athlete's own
    // history) remain byte-for-byte unchanged for all existing callers.
    const params = {
      where: {
        AND: [
          assignmentParticipantWhere(actor.id),
          ...(query.status ? [{ status: query.status }] : []),
        ],
      },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      ...(query.view === 'summary' ? { view: 'summary' as const } : {}),
    } satisfies Parameters<TrainingProgramAssignmentRepository['findManyAssignments']>[0];

    return this.repository.findManyAssignmentsForParticipant(params, actor.id);
  }

  async findOneAssignment(assignmentId: string, actor: TrainingProgramActor) {
    await this.accessService.assertAssignmentParticipant(actor);

    // Both full and restricted projections are guarded by current persisted
    // account state. A revoked trainer can read IDs/status, not athlete contact.
    const full = await this.repository.findAssignmentById(
      assignmentId,
      assignmentFullReadWhere(actor.id),
    );
    if (full) return full;

    const restricted = await this.repository.findRestrictedAssignmentById(
      assignmentId,
      assignmentParticipantWhere(actor.id),
    );

    if (!restricted) {
      throw new NotFoundException('Training program assignment not found.');
    }
    return restricted;
  }

  async findOneAssignmentDetails(assignmentId: string, actor: TrainingProgramActor) {
    await this.accessService.assertAssignmentParticipant(actor);

    const full = await this.repository.findAssignmentDetailsById(
      assignmentId,
      assignmentFullReadWhere(actor.id),
    );
    if (full) return full;

    const restricted = await this.repository.findRestrictedAssignmentById(
      assignmentId,
      assignmentParticipantWhere(actor.id),
    );

    if (!restricted) {
      throw new NotFoundException('Training program assignment not found.');
    }
    return restricted;
  }

  async completeAssignment(assignmentId: string, actor: TrainingProgramActor) {
    const assignment = await this.findOneAssignment(assignmentId, actor);

    // A TRAINER-role user can also be an athlete. The relationship side,
    // not the session's role, determines who can complete an assignment.
    if (assignment.athleteId !== actor.id) {
      throw new ForbiddenException('Only the assigned athlete can complete this program.');
    }

    if (assignment.status !== 'ACTIVE') {
      throw new ConflictException('Only active assignments can be completed.');
    }

    const result = await this.repository.completeAssignmentIfNoUnfinishedWorkouts({
      assignmentId,
      athleteId: actor.id,
      completedAt: new Date(),
    });

    switch (result.status) {
      case 'COMPLETED':
        return result.assignment;

      case 'HAS_UNFINISHED_WORKOUTS':
        throw new ConflictException(
          `Cannot complete assignment: ${result.unfinishedCount} unfinished workout(s) remain.`,
        );

      case 'NOT_ACTIVE':
        throw new ConflictException('Assignment state has changed. Reload and try again.');
    }
  }

  async cancelAssignment(
    assignmentId: string,
    actor: TrainingProgramActor,
    input: CancelTrainingProgramAssignmentInput = {},
  ) {
    // Cancelling somebody else's training is a trainer privilege, not an
    // athlete-side cleanup operation. Read the current approval, not JWT role.
    await this.accessService.assertTrainer(actor);

    const assignment = await this.findOneAssignment(assignmentId, actor);
    if (assignment.assignedById !== actor.id || assignment.trainerAthlete.trainerId !== actor.id) {
      throw new ForbiddenException('Only the assigning trainer can cancel this program.');
    }
    if (assignment.status !== 'ACTIVE') {
      throw new ConflictException('Only active assignments can be cancelled.');
    }

    try {
      const cancelled = await this.repository.cancelAssignmentIfTrainerEligible({
        assignmentId,
        trainerId: actor.id,
        endedAt: new Date(),
        reason: input.reason?.trim() || null,
      });

      if (!cancelled) {
        throw new ConflictException('Assignment or trainer eligibility has changed. Reload.');
      }
      return cancelled;
    } catch (error) {
      if (error instanceof AssignmentCancellationStateChanged) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  private validateAssignmentPagination(query: TrainingProgramAssignmentListQuery): void {
    if (
      !Number.isInteger(query.page) ||
      query.page < 1 ||
      !Number.isInteger(query.limit) ||
      query.limit < 1 ||
      query.limit > 100
    ) {
      throw new BadRequestException('Invalid pagination parameters.');
    }
  }
}
