import { Injectable } from '@nestjs/common';
import { PrismaService } from '#src/infra/database/index';
import { Prisma } from '#prisma/client';
import { deriveAccountCapabilities } from '#src/modules/users/policies/account-capabilities.policy';
import { assignmentFullReadWhere } from '../policies/training-program-assignment-read.policy.js';
import {
  trainingProgramAssignmentSelect,
  trainingProgramAssignmentDetailsSelect,
  trainingProgramAssignmentHistoricalSelect,
  trainingProgramAssignmentSummarySelect,
} from '../selects/training-program-assignment.select.js';
import type {
  TrainingProgramAssignmentPayload,
  TrainingProgramAssignmentDetailsPayload,
  TrainingProgramAssignmentSummaryPayload,
} from '../types/training-program-payload.types.js';
import type { PaginatedResult } from '../types/paginated-result.types.js';
import type { FindManyTrainingProgramAssignmentsParams } from '../types/training-program-repository.types.js';

@Injectable()
export class TrainingProgramAssignmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyAssignments({
    where,
    skip,
    take,
    orderBy = [{ assignedAt: 'desc' }, { id: 'desc' }],
    view = 'full',
  }: FindManyTrainingProgramAssignmentsParams): Promise<
    PaginatedResult<TrainingProgramAssignmentPayload | TrainingProgramAssignmentSummaryPayload>
  > {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.trainingProgramAssignment.findMany({
        where,
        skip,
        take,
        orderBy,
        select:
          view === 'summary'
            ? trainingProgramAssignmentSummarySelect
            : trainingProgramAssignmentSelect,
      }),
      this.prisma.trainingProgramAssignment.count({ where }),
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

  async findManyAssignmentsForParticipant(
    {
      where,
      skip,
      take,
      orderBy = [{ assignedAt: 'desc' }, { id: 'desc' }],
      view = 'full',
    }: FindManyTrainingProgramAssignmentsParams,
    actorId: string,
  ) {
    // 1. Load a paginated list without sensitive fields.
    const [historicalAssignments, total] = await this.prisma.$transaction([
      this.prisma.trainingProgramAssignment.findMany({
        where,
        skip,
        take,
        orderBy,
        select: trainingProgramAssignmentHistoricalSelect,
      }),

      this.prisma.trainingProgramAssignment.count({
        where,
      }),
    ]);

    // 2. Recheck every page row at query time: own athlete history
    // stays full, but trainers only see contacts with live approval AND an
    // active relationship. Revoked trainer rows remain redacted.
    const ids = historicalAssignments.map((assignment) => assignment.id);
    const fullAssignments =
      ids.length > 0
        ? await this.prisma.trainingProgramAssignment.findMany({
            where: {
              AND: [
                where,
                {
                  id: { in: ids },
                  ...assignmentFullReadWhere(actorId),
                },
              ],
            },
            select:
              view === 'summary'
                ? trainingProgramAssignmentSummarySelect
                : trainingProgramAssignmentSelect,
          })
        : [];

    const fullById = new Map(fullAssignments.map((assignment) => [assignment.id, assignment]));

    // 4. Preserve the original page order.
    const data = historicalAssignments.map(
      (assignment) => fullById.get(assignment.id) ?? assignment,
    );

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

  async findAssignmentById(
    id: string,
    where: Prisma.TrainingProgramAssignmentWhereInput = {},
  ): Promise<TrainingProgramAssignmentPayload | null> {
    return this.prisma.trainingProgramAssignment.findFirst({
      where: {
        AND: [{ id }, where],
      },
      select: trainingProgramAssignmentSelect,
    });
  }

  async findAssignmentDetailsById(
    id: string,
    where: Prisma.TrainingProgramAssignmentWhereInput = {},
  ): Promise<TrainingProgramAssignmentDetailsPayload | null> {
    return this.prisma.trainingProgramAssignment.findFirst({
      where: {
        AND: [{ id }, where],
      },
      select: trainingProgramAssignmentDetailsSelect,
    });
  }

  async findRestrictedAssignmentById(
    id: string,
    where: Prisma.TrainingProgramAssignmentWhereInput,
  ) {
    return this.prisma.trainingProgramAssignment.findFirst({
      where: { AND: [{ id }, where] },
      select: trainingProgramAssignmentHistoricalSelect,
    });
  }

  async findActiveAssignmentByRelationship(
    trainerAthleteId: string,
  ): Promise<TrainingProgramAssignmentPayload[]> {
    return this.prisma.trainingProgramAssignment.findMany({
      where: {
        trainerAthleteId,
        status: 'ACTIVE',
      },
      select: trainingProgramAssignmentSelect,
    });
  }

  async updateAssignment(
    where: Prisma.TrainingProgramAssignmentWhereUniqueInput,
    data: Prisma.TrainingProgramAssignmentUpdateInput,
  ): Promise<TrainingProgramAssignmentPayload> {
    return this.prisma.trainingProgramAssignment.update({
      where,
      data,
      select: trainingProgramAssignmentSelect,
    });
  }

  async createAssignmentForActiveRelationship(input: {
    programId: string;
    versionId: string;
    trainerAthleteId: string;
    trainerId: string;
    athleteId: string;
  }): Promise<TrainingProgramAssignmentPayload | null> {
    return this.prisma.$transaction(async (tx) => {
      // Fetch the immutable PUBLISHED source tree first. A published version
      // cannot be edited by application endpoints, and the version lock below
      // still enforces the final eligibility check.
      const source = await tx.trainingProgramVersion.findFirst({
        where: {
          id: input.versionId,
          programId: input.programId,
          status: 'PUBLISHED',
        },
        select: {
          workouts: {
            select: {
              exercises: { select: { exerciseId: true } },
            },
          },
        },
      });
      if (!source) return null;

      const exerciseIds = [
        ...new Set(
          source.workouts.flatMap((workout) =>
            workout.exercises.map((exercise) => exercise.exerciseId),
          ),
        ),
      ];

      // Match the workout create/start lock order: source exercise rows
      // BEFORE trainer-athlete relationship. An archive UPDATE conflicts
      // with FOR SHARE, so a new assignment cannot commit with a source
      // that was already archived at authorization time.
      if (exerciseIds.length > 0) {
        const available = await tx.$queryRaw<
          Array<{
            id: string;
            source: string;
            createdById: string | null;
            isArchived: boolean;
          }>
        >`
          SELECT
            "id", "source",
            "created_by_id" AS "createdById",
            "is_archived" AS "isArchived"
          FROM "exercises"
          WHERE "id" IN (${Prisma.join(exerciseIds)})
          ORDER BY "id"
          FOR SHARE
        `;
        if (
          available.length !== exerciseIds.length ||
          available.some(
            (exercise) =>
              exercise.isArchived ||
              (exercise.source !== 'GLOBAL' &&
                (exercise.source !== 'TRAINER_CUSTOM' || exercise.createdById !== input.trainerId)),
          )
        )
          return null;
      }

      // Lock order: exercise -> relationship -> version -> program.
      // Termination serializes on the relationship; publishing guards
      // the version, and archiving a program updates the program row.
      const relationships = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "trainer_athletes"
        WHERE "id" = ${input.trainerAthleteId}
          AND "trainer_id" = ${input.trainerId}
          AND "athlete_id" = ${input.athleteId}
          AND "status" = 'ACTIVE'
        FOR UPDATE
      `;

      if (relationships.length !== 1) {
        return null;
      }

      // Recheck the version while holding a row lock. The PUBLISHED
      // version must belong to the exact program being assigned.
      const versions = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "training_program_versions"
        WHERE "id" = ${input.versionId}
          AND "program_id" = ${input.programId}
          AND "status" = 'PUBLISHED'
        FOR SHARE
      `;

      if (versions.length !== 1) {
        return null;
      }

      // An archive transaction cannot commit between this check
      // and insertion of the assignment.
      const programs = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "training_programs"
        WHERE "id" = ${input.programId}
          AND "trainer_id" = ${input.trainerId}
          AND "status" <> 'ARCHIVED'
        FOR SHARE
      `;

      if (programs.length !== 1) {
        return null;
      }

      // The service's initial capability read is not authoritative. Moderation
      // can revoke approval before the program/relationship locks above.
      // Lock users in deterministic order, then the trainer's existing
      // TrainerProfile, and re-read persisted eligibility before INSERT.
      // FOR UPDATE on users also blocks FK-backed creation of a missing
      // TrainerProfile until this transaction commits.
      const participantIds = [input.trainerId, input.athleteId].sort();
      const lockedParticipants = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "users"
        WHERE "id" IN (${Prisma.join(participantIds)})
        ORDER BY "id"
        FOR UPDATE
      `;
      if (lockedParticipants.length !== 2) return null;

      await tx.$queryRaw`
        SELECT "id"
        FROM "trainer_profiles"
        WHERE "user_id" = ${input.trainerId}
        FOR UPDATE
      `;

      const participants = await tx.user.findMany({
        where: { id: { in: participantIds }, deletedAt: null },
        select: {
          id: true,
          role: true,
          trainerProfile: { select: { isActive: true } },
        },
      });
      const trainer = participants.find((user) => user.id === input.trainerId);
      const athlete = participants.find((user) => user.id === input.athleteId);
      if (
        !trainer ||
        !athlete ||
        !deriveAccountCapabilities(trainer).trainer ||
        !deriveAccountCapabilities(athlete).athlete
      ) {
        return null;
      }

      // Build the references from checked identifiers; callers cannot
      // validate one version and insert an assignment for another.
      return tx.trainingProgramAssignment.create({
        data: {
          version: { connect: { id: input.versionId } },
          trainerAthlete: { connect: { id: input.trainerAthleteId } },
          athlete: { connect: { id: input.athleteId } },
          assignedBy: { connect: { id: input.trainerId } },
        },
        select: trainingProgramAssignmentSelect,
      });
    });
  }

  async completeAssignmentIfNoUnfinishedWorkouts(input: {
    assignmentId: string;
    athleteId: string;
    completedAt: Date;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const assignments = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "training_program_assignments"
      WHERE
        "id" = ${input.assignmentId}
        AND "athlete_id" = ${input.athleteId}
        AND "status" = 'ACTIVE'
      FOR UPDATE
    `;

      if (assignments.length !== 1) {
        return { status: 'NOT_ACTIVE' as const };
      }

      const unfinishedCount = await tx.workout.count({
        where: {
          programAssignmentId: input.assignmentId,
          status: {
            in: ['PLANNED', 'IN_PROGRESS'],
          },
        },
      });

      if (unfinishedCount > 0) {
        return {
          status: 'HAS_UNFINISHED_WORKOUTS' as const,
          unfinishedCount,
        };
      }

      const assignment = await tx.trainingProgramAssignment.update({
        where: {
          id: input.assignmentId,
          status: 'ACTIVE',
        },
        data: {
          status: 'COMPLETED',
          completedAt: input.completedAt,
        },
        select: trainingProgramAssignmentSelect,
      });

      return {
        status: 'COMPLETED' as const,
        assignment,
      };
    });
  }
}
