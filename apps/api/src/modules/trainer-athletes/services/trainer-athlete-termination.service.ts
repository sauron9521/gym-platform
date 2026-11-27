import { Injectable } from '@nestjs/common';

import type { Prisma } from '#prisma/client';
import { PrismaService } from '#src/infra/database/index';
import type {
  RelationshipTerminationResult,
  TerminateRelationshipCommand,
} from '../application/terminate-relationship.js';
import { publishProgramAssignmentTransition } from '#src/modules/notifications/public-api';
import { publishRelationshipTransition } from '../repositories/publish-relationship-transition.js';
import { TrainerAthleteExerciseCopyService } from './trainer-athlete-exercise-copy.service.js';
import {
  trainerAthleteHistoricalSelect,
  trainerAthleteSelect,
} from '../selects/trainer-athlete.select.js';

type RelationshipProjection =
  | Prisma.TrainerAthleteGetPayload<{ select: typeof trainerAthleteSelect }>
  | Prisma.TrainerAthleteGetPayload<{ select: typeof trainerAthleteHistoricalSelect }>;

/**
 * Coordinates relationship termination, copies, assignment termination and
 * access revocation in one PostgreSQL transaction. Never commit between them.
 */
@Injectable()
export class TrainerAthleteTerminationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exerciseCopyService: TrainerAthleteExerciseCopyService,
  ) {}

  async terminateWithExerciseCopies(
    input: TerminateRelationshipCommand,
  ): Promise<RelationshipTerminationResult<RelationshipProjection>> {
    const endedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1. Verify that the relationship is still active
      // and that the actor is one of its participants.
      const relationship = await tx.trainerAthlete.findFirst({
        where: {
          id: input.id,
          status: 'ACTIVE',
          OR: [{ trainerId: input.actorId }, { athleteId: input.actorId }],
        },
        select: {
          id: true,
          trainerId: true,
          athleteId: true,
          createdAt: true,
          respondedAt: true,
        },
      });

      if (!relationship) {
        return { status: 'STATE_CHANGED' };
      }

      // 2. Claim the transition. Only one concurrent request can win.
      const transition = await tx.trainerAthlete.updateMany({
        where: {
          id: input.id,
          status: 'ACTIVE',
          OR: [{ trainerId: input.actorId }, { athleteId: input.actorId }],
        },
        data: {
          status: 'TERMINATED',
          endedAt,
          endedById: input.actorId,
          endReason: input.reason ?? null,
        },
      });

      if (transition.count !== 1) {
        return { status: 'STATE_CHANGED' };
      }

      // 3. Collect exercises from active training program assignments.
      const activeProgramAssignments = await tx.trainingProgramAssignment.findMany({
        where: {
          trainerAthleteId: relationship.id,
          status: 'ACTIVE',
        },
        select: {
          version: {
            select: {
              workouts: {
                select: {
                  exercises: {
                    select: {
                      exerciseId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const programExerciseIds = [
        ...new Set(
          activeProgramAssignments.flatMap(({ version }) =>
            version.workouts.flatMap((workout) =>
              workout.exercises.map(({ exerciseId }) => exerciseId),
            ),
          ),
        ),
      ];

      // 3. Terminate all active program assignments
      // associated with this trainer-athlete relationship.
      const terminatedAssignments = await tx.trainingProgramAssignment.updateManyAndReturn({
        where: {
          trainerAthleteId: relationship.id,
          status: 'ACTIVE',
        },
        data: {
          status: 'TERMINATED',
          endedAt,
          endedById: input.actorId,
          endReason: input.reason ?? null,
        },
        select: {
          id: true,
          status: true,
          athleteId: true,
          assignedById: true,
          assignedAt: true,
          completedAt: true,
          endedAt: true,
          endedById: true,
        },
      });

      for (const assignment of terminatedAssignments) {
        await publishProgramAssignmentTransition(tx, assignment);
      }

      const activeFrom = relationship.respondedAt ?? relationship.createdAt;

      // Keep exercise copying in the SAME transaction as revocations.
      await this.exerciseCopyService.copyRelevantExercises(
        tx,
        relationship,
        activeFrom,
        programExerciseIds,
      );

      // 6. Revoke trainer-to-athlete exercise assignments.
      await tx.exerciseAthleteAssignment.updateMany({
        where: {
          athleteId: relationship.athleteId,
          assignedById: relationship.trainerId,
          revokedAt: null,
        },
        data: {
          revokedAt: endedAt,
        },
      });

      // 7. Revoke trainer access to athlete-owned selected exercises.
      await tx.exerciseTrainerAccess.updateMany({
        where: {
          trainerId: relationship.trainerId,
          revokedAt: null,
          exercise: {
            is: {
              createdById: relationship.athleteId,
              source: 'ATHLETE_CUSTOM',
            },
          },
        },
        data: {
          revokedAt: endedAt,
        },
      });

      // 8. Return the terminated relationship.
      const terminated = await tx.trainerAthlete.findUnique({
        where: {
          id: relationship.id,
        },
        select: input.redactForTrainer ? trainerAthleteHistoricalSelect : trainerAthleteSelect,
      });
      if (!terminated) throw new Error('Terminated relationship missing');
      await publishRelationshipTransition(tx, terminated);
      return { status: 'TERMINATED', relationship: terminated };
    });
  }
}
