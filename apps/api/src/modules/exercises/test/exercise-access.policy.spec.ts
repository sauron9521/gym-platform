import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  assertCanManageExercise,
  buildExerciseManagementLookupWhere,
  buildExerciseVisibilityWhere,
  getExerciseManagementWhere,
  resolveExerciseSource,
  resolveExerciseVisibility,
} from '../policies/exercise-access.policy.js';
import type { ExerciseActor, ExerciseAccessContext } from '../types/exercise.types.js';

const trainer: ExerciseActor = { id: 'trainer-1', role: 'TRAINER' };
const athlete: ExerciseActor = { id: 'athlete-1', role: 'ATHLETE' };
const admin: ExerciseActor = { id: 'admin-1', role: 'ADMIN' };
const access: ExerciseAccessContext = {
  activeTrainerIds: ['trainer-1'],
  activeAthleteIds: ['athlete-1'],
};

const liveTrainerGrant = (trainerId: string) => ({
  trainerId,
  revokedAt: null,
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
});

describe('exercise access policy', () => {
  it('restricts guests to global exercises', () => {
    expect(buildExerciseVisibilityWhere(null, access)).toEqual({ source: 'GLOBAL' });
  });

  it('allows athletes their own and active trainers custom exercises', () => {
    expect(buildExerciseVisibilityWhere(athlete, access)).toEqual({
      OR: [
        { source: 'GLOBAL' },
        { source: 'ATHLETE_CUSTOM', createdById: athlete.id },
        { source: 'TRAINER_CUSTOM', createdById: athlete.id },
        {
          source: 'ATHLETE_CUSTOM',
          visibility: 'SELECTED_TRAINERS',
          createdById: { in: ['athlete-1'] },
          trainerAccesses: { some: liveTrainerGrant(athlete.id) },
          createdBy: {
            is: {
              athleteRelationships: {
                some: { trainerId: athlete.id, status: 'ACTIVE' },
              },
            },
          },
        },
        {
          source: 'TRAINER_CUSTOM',
          createdById: { in: ['trainer-1'] },
          createdBy: {
            is: {
              trainerRelationships: {
                some: { athleteId: athlete.id, status: 'ACTIVE' },
              },
            },
          },
        },
      ],
    });
  });

  it('never grants trainer-side access to an ATHLETE without live capability', () => {
    const athleteOnly: ExerciseAccessContext = {
      activeTrainerIds: ['trainer-1'],
      activeAthleteIds: [],
    };
    const where = buildExerciseVisibilityWhere(athlete, athleteOnly);
    expect(where).toEqual({
      OR: [
        { source: 'GLOBAL' },
        { source: 'ATHLETE_CUSTOM', createdById: athlete.id },
        { source: 'TRAINER_CUSTOM', createdById: athlete.id },
        {
          source: 'TRAINER_CUSTOM',
          createdById: { in: ['trainer-1'] },
          createdBy: {
            is: {
              trainerRelationships: {
                some: { athleteId: athlete.id, status: 'ACTIVE' },
              },
            },
          },
        },
      ],
    });
  });

  it('requires an explicit, unrevoked grant for trainer access to athlete exercises', () => {
    expect(buildExerciseVisibilityWhere(trainer, access)).toEqual({
      OR: [
        { source: 'GLOBAL' },
        { source: 'ATHLETE_CUSTOM', createdById: trainer.id },
        { source: 'TRAINER_CUSTOM', createdById: trainer.id },
        {
          source: 'ATHLETE_CUSTOM',
          visibility: 'SELECTED_TRAINERS',
          createdById: { in: ['athlete-1'] },
          trainerAccesses: { some: liveTrainerGrant(trainer.id) },
          createdBy: {
            is: {
              athleteRelationships: {
                some: { trainerId: trainer.id, status: 'ACTIVE' },
              },
            },
          },
        },
      ],
    });
  });

  it('does not substitute the cached actor context for a current relationship check', () => {
    const context = {
      activeTrainerIds: ['former-trainer'],
      activeAthleteIds: ['former-athlete'],
    };
    const athleteScope = buildExerciseVisibilityWhere(athlete, context);
    const trainerScope = buildExerciseVisibilityWhere(trainer, context);
    expect(athleteScope).toEqual(
      expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({
            createdById: { in: ['former-trainer'] },
            createdBy: {
              is: {
                trainerRelationships: {
                  some: { athleteId: athlete.id, status: 'ACTIVE' },
                },
              },
            },
          }),
        ]),
      }),
    );
    expect(trainerScope).toEqual(
      expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({
            createdById: { in: ['former-athlete'] },
            trainerAccesses: { some: liveTrainerGrant(trainer.id) },
            createdBy: {
              is: {
                athleteRelationships: {
                  some: { trainerId: trainer.id, status: 'ACTIVE' },
                },
              },
            },
          }),
        ]),
      }),
    );
  });

  it('retains self-owned athlete exercises for a TRAINER without exposing others', () => {
    const revoked = buildExerciseVisibilityWhere(trainer, {
      activeTrainerIds: [],
      activeAthleteIds: [],
    });
    expect(revoked).toEqual({
      OR: [
        { source: 'GLOBAL' },
        { source: 'ATHLETE_CUSTOM', createdById: trainer.id },
        { source: 'TRAINER_CUSTOM', createdById: trainer.id },
        expect.objectContaining({
          source: 'ATHLETE_CUSTOM',
          createdById: { in: [] },
          trainerAccesses: { some: liveTrainerGrant(trainer.id) },
        }),
      ],
    });
  });

  it('limits Admin catalog reads to global exercises, never private user content', () => {
    expect(buildExerciseVisibilityWhere(admin, access)).toEqual({ source: 'GLOBAL' });
    expect(resolveExerciseSource(admin, { athlete: false, trainer: false, admin: true })).toBe(
      'GLOBAL',
    );
    expect(resolveExerciseSource(trainer, { athlete: true, trainer: true, admin: false })).toBe(
      'TRAINER_CUSTOM',
    );
    expect(resolveExerciseSource(athlete, { athlete: true, trainer: false, admin: false })).toBe(
      'ATHLETE_CUSTOM',
    );
  });

  it('uses current capabilities rather than legacy role for exercise creation', () => {
    const activeDual = { athlete: true, trainer: true, admin: false };
    const revokedTrainer = { athlete: true, trainer: false, admin: false };
    const promotedAdmin = { athlete: false, trainer: false, admin: true };

    expect(resolveExerciseSource(athlete, activeDual)).toBe('ATHLETE_CUSTOM');
    expect(resolveExerciseSource(trainer, revokedTrainer)).toBe('ATHLETE_CUSTOM');
    expect(() => resolveExerciseSource(trainer, promotedAdmin)).toThrow(ForbiddenException);
    expect(() => resolveExerciseSource(athlete, promotedAdmin)).toThrow(ForbiddenException);
    expect(() => resolveExerciseSource(admin, activeDual)).toThrow(ForbiddenException);
    expect(() =>
      resolveExerciseSource(athlete, { athlete: false, trainer: false, admin: false }),
    ).toThrow(ForbiddenException);
  });

  it('allows explicit Athlete/Trainer scopes only with live authorization', () => {
    const dual = { athlete: true, trainer: true, admin: false };
    const revoked = { athlete: true, trainer: false, admin: false };
    const onlyAdmin = { athlete: false, trainer: false, admin: true };

    expect(resolveExerciseSource(athlete, dual, 'TRAINER')).toBe('TRAINER_CUSTOM');
    expect(resolveExerciseSource(athlete, dual, 'ATHLETE')).toBe('ATHLETE_CUSTOM');
    expect(resolveExerciseSource(trainer, dual, 'ATHLETE')).toBe('ATHLETE_CUSTOM');
    expect(resolveExerciseSource(trainer, dual, 'TRAINER')).toBe('TRAINER_CUSTOM');
    expect(resolveExerciseSource(trainer, revoked, 'ATHLETE')).toBe('ATHLETE_CUSTOM');
    expect(() => resolveExerciseSource(trainer, revoked, 'TRAINER')).toThrow(
      ForbiddenException,
    );
    expect(() => resolveExerciseSource(athlete, revoked, 'TRAINER')).toThrow(
      ForbiddenException,
    );
    expect(() => resolveExerciseSource(admin, onlyAdmin, 'ATHLETE')).toThrow(
      ForbiddenException,
    );
    expect(() => resolveExerciseSource(admin, onlyAdmin, 'TRAINER')).toThrow(
      ForbiddenException,
    );
    expect(resolveExerciseSource(admin, onlyAdmin)).toBe('GLOBAL');
  });

  it('keeps private as athlete default and rejects visibility on non-athlete exercises', () => {
    expect(resolveExerciseVisibility('ATHLETE_CUSTOM')).toBe('PRIVATE');
    expect(resolveExerciseVisibility('ATHLETE_CUSTOM', 'SELECTED_TRAINERS')).toBe(
      'SELECTED_TRAINERS',
    );
    expect(resolveExerciseVisibility('TRAINER_CUSTOM')).toBeNull();
    expect(() => resolveExerciseVisibility('TRAINER_CUSTOM', 'PRIVATE')).toThrow(
      BadRequestException,
    );
  });

  it.each([athlete, trainer, admin])(
    'limits management lookups to global and actor-owned exercises: %s',
    (actor) => {
      expect(buildExerciseManagementLookupWhere(actor)).toEqual({
        isArchived: false,
        OR: [{ source: 'GLOBAL' }, { source: { not: 'GLOBAL' }, createdById: actor.id }],
      });
    },
  );

  it('preserves 403 for visible global resources and 404 for foreign custom resources', () => {
    const global = { id: 'ex-global', source: 'GLOBAL' as const, createdById: null };
    const foreign = {
      id: 'ex-private',
      source: 'ATHLETE_CUSTOM' as const,
      createdById: 'other-user',
    };
    expect(() => assertCanManageExercise(athlete, global)).toThrow(ForbiddenException);
    expect(() => assertCanManageExercise(trainer, global)).toThrow(ForbiddenException);
    expect(() => assertCanManageExercise(admin, global)).not.toThrow();
    for (const actor of [athlete, trainer, admin]) {
      expect(() => assertCanManageExercise(actor, foreign)).toThrow(NotFoundException);
    }
  });

  it('enforces ownership for writes and scopes conditional update predicates', () => {
    const own = { id: 'ex-1', source: 'ATHLETE_CUSTOM' as const, createdById: athlete.id };
    expect(() => assertCanManageExercise(athlete, own)).not.toThrow();
    expect(getExerciseManagementWhere(athlete, own)).toEqual({
      id: 'ex-1',
      createdById: athlete.id,
      source: 'ATHLETE_CUSTOM',
      isArchived: false,
    });
    expect(() => assertCanManageExercise(trainer, own)).toThrow(NotFoundException);
    const global = { id: 'ex-2', source: 'GLOBAL' as const, createdById: null };
    expect(() => assertCanManageExercise(admin, global)).not.toThrow();
    expect(getExerciseManagementWhere(admin, global)).toEqual({
      id: 'ex-2',
      source: 'GLOBAL',
      isArchived: false,
    });
  });
});
