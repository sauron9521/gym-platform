import { describe, expect, it } from 'vitest';

import { RATE_LIMIT_POLICIES } from './rate-limit.policies.js';

import { ExercisesController } from '#src/modules/exercises/controllers/exercises.controller';
import { WorkoutsController } from '#src/modules/workouts/controllers/workouts.controller';
import { WorkoutAnalyticsController } from '#src/api/athlete/workout-analytics/controllers/workout-analytics.controller';
import { AuthController } from '#src/api/public/auth/controllers/auth.controller';
import { UsersController } from '#src/api/shared/users/controllers/users.controller';
import { TrainerApplicationsController } from '#src/api/shared/trainer-onboarding/controllers/trainer-applications.controller';
import { TrainerReviewController } from '#src/api/admin/trainer-onboarding/controllers/trainer-review.controller';
import { TrainerAthletesController } from '#src/api/shared/trainer-athletes/controllers/trainer-athletes.controller';
import { TrainingProgramsController } from '#src/modules/training-programs/controllers/training-programs.controller';
import { TrainingProgramVersionsController } from '#src/modules/training-programs/controllers/training-program-versions.controller';

describe('Endpoint-aware throttling policies', () => {
  it('centralizes the global default and every semantic endpoint budget', () => {
    expect(RATE_LIMIT_POLICIES).toEqual({
      global: { limit: 10, ttl: 60_000 },
      read: { limit: 60, ttl: 60_000 },
      analytics: { limit: 20, ttl: 60_000 },
      auth: { limit: 3, ttl: 60_000 },
      avatar: { limit: 5, ttl: 60_000 },
      workoutSet: { limit: 120, ttl: 60_000 },
    });
  });

  // Nest throttler stores method-level limits under this metadata key.
  const limitKey = 'THROTTLER:LIMITdefault';
  const ttlKey = 'THROTTLER:TTLdefault';

  // Read the method's descriptor; these handlers are metadata targets, not
  // callbacks, and must never be invoked without their controller instance.
  it.each([
    [ExercisesController, 'findMany', 60],
    [ExercisesController, 'findOne', 60],
    [WorkoutsController, 'findMany', 60],
    [WorkoutsController, 'findOne', 60],
    [WorkoutsController, 'updateSet', 120],
    [WorkoutAnalyticsController, 'summary', 20],
    [WorkoutAnalyticsController, 'exercise', 20],
    [AuthController, 'signIn', 3],
    [AuthController, 'signUp', 3],
    [UsersController, 'me', 60],
    [UsersController, 'uploadAvatar', 5],
    [UsersController, 'deleteAvatar', 5],
    [TrainerApplicationsController, 'findMine', 60],
    [TrainerApplicationsController, 'submit', 3],
    [TrainerApplicationsController, 'updateMine', 3],
    [TrainerReviewController, 'findPending', 60],
    [TrainerReviewController, 'approve', 3],
    [TrainerReviewController, 'reject', 3],
    [TrainerReviewController, 'revoke', 3],
    [TrainerAthletesController, 'findMany', 60],
    [TrainerAthletesController, 'findOne', 60],
    [TrainingProgramsController, 'findMany', 60],
    [TrainingProgramVersionsController, 'findVersions', 60],
  ] as const)(
    'defines the intended per-minute limit for %s.%s',
    (controller, methodName, limit) => {
      const handler = Object.getOwnPropertyDescriptor(controller.prototype, methodName)?.value;
      expect(handler).toBeTypeOf('function');
      expect(Reflect.getMetadata(limitKey, handler)).toBe(limit);
      expect(Reflect.getMetadata(ttlKey, handler)).toBe(60_000);
    },
  );

  it('retains the global policy for workout mutations', () => {
    for (const methodName of [
      'create',
      'update',
      'start',
      'complete',
      'cancel',
      'createFromProgram',
    ] as const) {
      const handler = Object.getOwnPropertyDescriptor(
        WorkoutsController.prototype,
        methodName,
      )?.value;
      expect(handler).toBeTypeOf('function');
      expect(Reflect.getMetadata(limitKey, handler)).toBeUndefined();
    }
  });

  it('keeps Trainer–Athlete mutation throttles separate from frequent private reads', () => {
    for (const methodName of ['create', 'accept', 'decline', 'cancel', 'terminate'] as const) {
      const handler = Object.getOwnPropertyDescriptor(
        TrainerAthletesController.prototype,
        methodName,
      )?.value;
      expect(handler).toBeTypeOf('function');
      expect(Reflect.getMetadata(limitKey, handler)).toBeUndefined();
      expect(Reflect.getMetadata(ttlKey, handler)).toBeUndefined();
    }
  });

  it('retains the global policy for profile mutations', () => {
    const handler = Object.getOwnPropertyDescriptor(UsersController.prototype, 'updateMe')?.value;
    expect(handler).toBeTypeOf('function');
    expect(Reflect.getMetadata(limitKey, handler)).toBeUndefined();
    expect(Reflect.getMetadata(ttlKey, handler)).toBeUndefined();
  });
});
