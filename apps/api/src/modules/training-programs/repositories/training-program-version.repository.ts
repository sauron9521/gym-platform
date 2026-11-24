import { BadRequestException, Injectable } from '@nestjs/common';
import { assertPublishableVersion, ProgramPublicationError } from '../domain/publication.policy.js';
import { isWorkoutOutsideDuration } from '../domain/duration.policy.js';
import { DraftVersionCreationConflict } from '../application/draft-version-creation.js';
import {
  DraftVersionStateChanged,
  type DraftVersionChanges,
} from '../application/draft-version-update.js';
import { PrismaService } from '#src/infra/database/index';
import { trainingProgramVersionSelect } from '../selects/training-program-version.select.js';
import { trainingProgramDraftAccessSelect } from '../selects/training-program-access.select.js';
import { trainingProgramVersionListSelect } from '../selects/training-program-query.select.js';
import { Prisma } from '#prisma/client';
import type { TrainingProgramVersionPayload } from '../types/training-program-payload.types.js';
import type { PublishedTrainingProgramVersionsQuery } from '../types/training-program.types.js';

// A failed parent update must roll back the version write before returning null.
class PublicationRolledBack extends Error {}

@Injectable()
export class TrainingProgramVersionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findVersions(programId: string) {
    return this.prisma.trainingProgramVersion.findMany({
      where: { programId },
      orderBy: { version: 'desc' },
      select: trainingProgramVersionListSelect,
    });
  }

  async findPublishedVersions(
    programId: string,
    trainerId: string,
    { beforeVersion, limit }: PublishedTrainingProgramVersionsQuery,
  ) {
    return this.prisma.trainingProgramVersion.findMany({
      where: {
        programId,
        program: { trainerId },
        status: 'PUBLISHED',
        ...(beforeVersion === undefined ? {} : { version: { lt: beforeVersion } }),
      },
      orderBy: { version: 'desc' },
      take: limit + 1,
      select: trainingProgramVersionListSelect,
    });
  }

  async findVersionForEditing(id: string, where: Prisma.TrainingProgramVersionWhereInput = {}) {
    return this.prisma.trainingProgramVersion.findFirst({
      where: { AND: [{ id }, where] },
      select: trainingProgramDraftAccessSelect,
    });
  }

  async findVersionById(
    id: string,
    where: Prisma.TrainingProgramVersionWhereInput = {},
  ): Promise<TrainingProgramVersionPayload | null> {
    return this.prisma.trainingProgramVersion.findFirst({
      where: {
        AND: [{ id }, where],
      },
      select: trainingProgramVersionSelect,
    });
  }

  async findVersionByNumber(
    programId: string,
    version: number,
  ): Promise<TrainingProgramVersionPayload | null> {
    return this.prisma.trainingProgramVersion.findUnique({
      where: {
        programId_version: {
          programId,
          version,
        },
      },
      select: trainingProgramVersionSelect,
    });
  }

  async findDraftVersion(programId: string): Promise<TrainingProgramVersionPayload | null> {
    return this.prisma.trainingProgramVersion.findFirst({
      where: {
        programId,
        status: 'DRAFT',
      },
      select: trainingProgramVersionSelect,
    });
  }

  async createVersion(
    data: Prisma.TrainingProgramVersionCreateInput,
  ): Promise<TrainingProgramVersionPayload> {
    return this.prisma.trainingProgramVersion.create({
      data,
      select: trainingProgramVersionSelect,
    });
  }

  async updateDraftVersion(
    programId: string,
    versionId: string,
    changes: DraftVersionChanges,
  ): Promise<TrainingProgramVersionPayload> {
    try {
      return await this.updateVersion({ id: versionId, programId, status: 'DRAFT' }, changes);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new DraftVersionStateChanged();
      }
      throw error;
    }
  }

  async updateVersion(
    where: Prisma.TrainingProgramVersionWhereUniqueInput,
    data: Prisma.TrainingProgramVersionUpdateInput,
  ): Promise<TrainingProgramVersionPayload> {
    // Only a numeric duration change needs the additional invariant check.
    // All other writes retain their existing conditional update semantics.
    if (typeof data.durationWeeks !== 'number' || typeof where.id !== 'string') {
      return this.prisma.trainingProgramVersion.update({
        where,
        data,
        select: trainingProgramVersionSelect,
      });
    }

    const versionId = where.id;
    const requestedWeeks = data.durationWeeks;

    return this.prisma.$transaction(async (tx) => {
      // Serialize duration changes with publication and all draft edits.
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "training_program_versions"
        WHERE "id" = ${versionId}
        FOR UPDATE
      `;

      if (rows.length === 0) {
        // Preserve Prisma's normal not-found / conditional-update semantics.
        return tx.trainingProgramVersion.update({
          where,
          data,
          select: trainingProgramVersionSelect,
        });
      }

      const latestWorkout = await tx.trainingProgramWorkout.findFirst({
        where: { versionId },
        orderBy: { weekNumber: 'desc' },
        select: { weekNumber: true },
      });

      if (latestWorkout && isWorkoutOutsideDuration(latestWorkout.weekNumber, requestedWeeks)) {
        throw new BadRequestException('A workout week cannot exceed the program duration');
      }

      return tx.trainingProgramVersion.update({
        where,
        data,
        select: trainingProgramVersionSelect,
      });
    });
  }

  async createDraftFromLatestPublished(programId: string) {
    try {
      return await this.cloneLatestPublished(programId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DraftVersionCreationConflict();
      }
      throw error;
    }
  }

  private async cloneLatestPublished(programId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Serialize cloning requests on the parent program row. The partial
      // unique DRAFT index remains a second line of defence, but concurrent
      // requests now observe the first committed draft instead of racing to
      // insert and exposing Prisma P2002 to one caller. Program archival also
      // updates this row, so it cannot commit after eligibility is checked.
      const programs = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "training_programs"
        WHERE "id" = ${programId}
          AND "status" <> 'ARCHIVED'
        FOR UPDATE
      `;

      if (programs.length !== 1) {
        return null;
      }

      const existingDraft = await tx.trainingProgramVersion.findFirst({
        where: {
          programId,
          status: 'DRAFT',
        },
        select: { id: true },
      });

      if (existingDraft) {
        return null;
      }

      const source = await tx.trainingProgramVersion.findFirst({
        where: {
          programId,
          status: 'PUBLISHED',
        },
        orderBy: {
          version: 'desc',
        },
        select: trainingProgramVersionSelect,
      });

      if (!source) {
        return null;
      }

      return tx.trainingProgramVersion.create({
        data: {
          program: {
            connect: { id: programId },
          },

          version: source.version + 1,
          title: source.title,
          description: source.description,
          durationWeeks: source.durationWeeks,
          status: 'DRAFT',

          workouts: {
            create: source.workouts.map((workout) => ({
              weekNumber: workout.weekNumber,
              dayNumber: workout.dayNumber,
              title: workout.title,
              notes: workout.notes,

              exercises: {
                create: workout.exercises.map((exercise) => ({
                  exercise: {
                    connect: { id: exercise.exerciseId },
                  },

                  exerciseNameSnapshot: exercise.exerciseNameSnapshot,
                  exerciseTypeSnapshot: exercise.exerciseTypeSnapshot,

                  sortOrder: exercise.sortOrder,
                  notes: exercise.notes,

                  sets: {
                    create: exercise.sets.map((set) => ({
                      setNumber: set.setNumber,
                      setType: set.setType,

                      plannedReps: set.plannedReps,
                      plannedWeightKg: set.plannedWeightKg,
                      plannedDurationSeconds: set.plannedDurationSeconds,
                      plannedDistanceMeters: set.plannedDistanceMeters,

                      restSeconds: set.restSeconds,
                      targetRpe: set.targetRpe,
                      targetRir: set.targetRir,

                      notes: set.notes,
                    })),
                  },
                })),
              },
            })),
          },
        },
        select: trainingProgramVersionSelect,
      });
    });
  }

  async publishVersion(programId: string, versionId: string) {
    return this.prisma
      .$transaction(async (tx) => {
        // Every draft mutator writes to the version row, so this lock makes
        // the authoritative validation and publication atomic.
        const drafts = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "training_program_versions"
          WHERE "id" = ${versionId}
            AND "program_id" = ${programId}
            AND "status" = 'DRAFT'
          FOR UPDATE
        `;

        if (drafts.length !== 1) {
          return null;
        }

        // Re-read the complete version AFTER acquiring the lock.
        const currentVersion = await tx.trainingProgramVersion.findUnique({
          where: { id: versionId },
          select: trainingProgramVersionSelect,
        });

        if (!currentVersion || currentVersion.status !== 'DRAFT') {
          return null;
        }

        assertPublishableVersion(currentVersion);

        // Draft editors also take the version row lock through their nested
        // writes. Once the draft is locked, its reference set cannot change.
        // Lock the referenced exercise rows as well: archival is a conflicting
        // UPDATE, so no exercise can become archived between this check and
        // the PUBLISHED transition.
        const exerciseIds = [
          ...new Set(
            currentVersion.workouts.flatMap((workout) =>
              workout.exercises.map((exercise) => exercise.exerciseId),
            ),
          ),
        ];

        const sourceExercises = await tx.$queryRaw<
          Array<{
            id: string;
            source: string;
            createdById: string | null;
            isArchived: boolean;
          }>
        >`
          SELECT
            "id",
            "source",
            "created_by_id" AS "createdById",
            "is_archived" AS "isArchived"
          FROM "exercises"
          WHERE "id" IN (${Prisma.join(exerciseIds)})
          ORDER BY "id"
          FOR SHARE
        `;

        const program = await tx.trainingProgram.findUnique({
          where: { id: programId },
          select: { trainerId: true },
        });

        if (
          !program ||
          sourceExercises.length !== exerciseIds.length ||
          sourceExercises.some(
            (exercise) =>
              exercise.isArchived ||
              (exercise.source !== 'GLOBAL' &&
                (exercise.source !== 'TRAINER_CUSTOM' ||
                  exercise.createdById !== program.trainerId)),
          )
        ) {
          throw new ProgramPublicationError('UNAVAILABLE_EXERCISES');
        }

        const published = await tx.trainingProgramVersion.updateMany({
          where: {
            id: versionId,
            programId,
            status: 'DRAFT',
          },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        });

        if (published.count !== 1) {
          return null;
        }

        const programUpdate = await tx.trainingProgram.updateMany({
          where: {
            id: programId,
            status: { not: 'ARCHIVED' },
          },
          data: {
            status: 'PUBLISHED',
          },
        });

        if (programUpdate.count !== 1) {
          throw new PublicationRolledBack();
        }

        return tx.trainingProgramVersion.findUnique({
          where: { id: versionId },
          select: trainingProgramVersionSelect,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof PublicationRolledBack) {
          return null;
        }

        throw error;
      });
  }
}
