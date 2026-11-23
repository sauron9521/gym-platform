import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import type { ExerciseSource, ExerciseVisibility, Prisma } from '#prisma/client';
import type { ExerciseAccessContext, ExerciseActor } from '../types/exercise.types.js';

/** Centralizes all exercise read and write visibility rules. */
export function buildExerciseVisibilityWhere(
  actor: ExerciseActor | null,
  access: ExerciseAccessContext,
): Prisma.ExerciseWhereInput {
  if (!actor) {
    return { source: 'GLOBAL' };
  }

  if (actor.role === 'ADMIN') {
    // Admin capability does not authorize reading private Athlete/Trainer exercises.
    // Catalog moderation of personal content requires a separate, audited permission.
    return { source: 'GLOBAL' };
  }

  if (actor.role === 'ATHLETE') {
    return {
      OR: [
        { source: 'GLOBAL' },

        {
          source: 'ATHLETE_CUSTOM',
          createdById: actor.id,
        },

        // Approved ATHLETE-role trainers may also read explicitly shared athlete exercises.
        ...(access.activeAthleteIds.length > 0 ? [sharedAthleteExerciseWhere(actor, access)] : []),
        {
          source: 'TRAINER_CUSTOM',
          createdById: {
            in: access.activeTrainerIds,
          },
          // Re-check the relationship in the same SQL query. The context
          // above can be stale if collaboration ended after its lookup.
          createdBy: {
            is: {
              trainerRelationships: {
                some: { athleteId: actor.id, status: 'ACTIVE' },
              },
            },
          },
        },
      ],
    };
  }

  if (actor.role === 'TRAINER') {
    return {
      OR: [
        { source: 'GLOBAL' },

        // A legacy TRAINER identity is also an Athlete; preserve its own
        // private exercises without requiring any trainer-side grant.
        { source: 'ATHLETE_CUSTOM', createdById: actor.id },

        {
          source: 'TRAINER_CUSTOM',
          createdById: actor.id,
        },

        sharedAthleteExerciseWhere(actor, access),
      ],
    };
  }

  throw new ForbiddenException();
}

/**
 * Source selection is backward-compatible for clients without a creation scope:
 * legacy TRAINER defaults to trainer exercises, ATHLETE to personal exercises.
 * The session role is only a default preference; CURRENT persisted capabilities
 * are authoritative for authorization. A revoked Trainer retains Athlete use.
 */
type ExerciseCreationCapabilities = {
  athlete: boolean;
  trainer: boolean;
  admin: boolean;
};

export function resolveExerciseSource(
  actor: ExerciseActor,
  capabilities: ExerciseCreationCapabilities,
): ExerciseSource {
  if (actor.role === 'ADMIN') {
    if (!capabilities.admin) {
      throw new ForbiddenException('You cannot create global exercises');
    }
    return 'GLOBAL';
  }

  // Neither a stale Athlete/Trainer session nor an Admin account can claim
  // personal data privileges that the persisted account does not grant.
  if (!capabilities.athlete || capabilities.admin) {
    throw new ForbiddenException('Only athletes can create personal exercises');
  }

  return actor.role === 'TRAINER' && capabilities.trainer
    ? 'TRAINER_CUSTOM'
    : 'ATHLETE_CUSTOM';
}

export function resolveExerciseVisibility(
  source: ExerciseSource,
  requested?: ExerciseVisibility,
): ExerciseVisibility | null {
  if (source !== 'ATHLETE_CUSTOM') {
    if (requested !== undefined) {
      throw new BadRequestException('Visibility is only available for athlete custom exercises');
    }

    return null;
  }

  return requested ?? 'PRIVATE';
}

/**
 * Narrow management lookups to an exercise the actor owns or a global exercise.
 * Foreign custom IDs never reach the service, so PATCH and DELETE cannot reveal
 * their existence via a different status from an unknown ID.
 * Global exercises are included to preserve 403 for non-admin writers.
 */
export function buildExerciseManagementLookupWhere(
  actor: ExerciseActor,
): Prisma.ExerciseWhereInput {
  return {
    isArchived: false,
    OR: [{ source: 'GLOBAL' }, { source: { not: 'GLOBAL' }, createdById: actor.id }],
  };
}

export function assertCanManageExercise(
  actor: ExerciseActor,
  exercise: {
    source: ExerciseSource;
    createdById: string | null;
  },
): void {
  if (actor.role === 'ADMIN' && exercise.source === 'GLOBAL') {
    return;
  }

  if (exercise.source !== 'GLOBAL' && exercise.createdById === actor.id) {
    return;
  }

  if (exercise.source !== 'GLOBAL') {
    throw new NotFoundException('Exercise not found');
  }

  throw new ForbiddenException('You cannot modify this exercise');
}

export function getExerciseManagementWhere(
  actor: ExerciseActor,
  exercise: {
    id: string;
    source: ExerciseSource;
    createdById: string | null;
  },
): Prisma.ExerciseWhereUniqueInput {
  if (actor.role === 'ADMIN' && exercise.source === 'GLOBAL') {
    return {
      id: exercise.id,
      source: 'GLOBAL',
      isArchived: false,
    };
  }

  return {
    id: exercise.id,
    createdById: actor.id,
    source: exercise.source,
    isArchived: false,
  };
}

/** Same unrevoked grant + active relationship predicate for legacy and newly approved trainers. */
function sharedAthleteExerciseWhere(
  actor: ExerciseActor,
  access: ExerciseAccessContext,
): Prisma.ExerciseWhereInput {
  return {
    source: 'ATHLETE_CUSTOM',
    visibility: 'SELECTED_TRAINERS',
    createdById: { in: access.activeAthleteIds },
    trainerAccesses: {
      some: {
        trainerId: actor.id,
        revokedAt: null,
        // Re-check current TrainerProfile approval in this SAME SQL query.
        // A cached activeAthleteIds list must never outlive moderation.
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
      },
    },
    createdBy: {
      is: {
        athleteRelationships: {
          some: { trainerId: actor.id, status: 'ACTIVE' },
        },
      },
    },
  };
}
