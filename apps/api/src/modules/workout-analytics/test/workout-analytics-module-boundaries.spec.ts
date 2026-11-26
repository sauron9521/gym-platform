import { MODULE_METADATA } from '@nestjs/common/constants';
import { expectTypeOf } from 'vitest';
import { UsersModule } from '#src/modules/users/users.module';
import type { WorkoutActor } from '#src/modules/workouts/public-api';
import { WorkoutAnalyticsModule } from '../workout-analytics.module.js';
import * as publicApi from '../public-api.js';
import { WorkoutAnalyticsRepository } from '../repositories/workout-analytics.repository.js';
import * as schemas from '../dto/workout-analytics.schemas.js';
import * as responses from '../workout-analytics.responses.js';

describe('WorkoutAnalyticsModule public boundary', () => {
  it('exports exactly its existing service and keeps the repository private', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, WorkoutAnalyticsModule)).toEqual([
      UsersModule,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, WorkoutAnalyticsModule)).toEqual([
      WorkoutAnalyticsRepository,
      publicApi.WorkoutAnalyticsService,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, WorkoutAnalyticsModule)).toEqual([
      publicApi.WorkoutAnalyticsService,
    ]);
    expect(Object.getOwnPropertyNames(publicApi.WorkoutAnalyticsService.prototype)).toEqual([
      'constructor',
      'summary',
      'personalRecords',
      'previousSets',
      'exercise',
    ]);
  });

  it('re-exports only existing adapter schemas and response contracts', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'WorkoutAnalyticsService',
      'analyticsExerciseIdSchema',
      'previousSetsQuerySchema',
      'previousWorkoutSetsResponseSchema',
      'workoutAnalyticsExerciseResponseSchema',
      'workoutAnalyticsPersonalRecordsResponseSchema',
      'workoutAnalyticsQuerySchema',
      'workoutAnalyticsSummaryResponseSchema',
    ]);
    for (const key of [
      'analyticsExerciseIdSchema',
      'previousSetsQuerySchema',
      'workoutAnalyticsQuerySchema',
    ] as const) {
      expect(publicApi[key]).toBe(schemas[key]);
    }
    for (const key of [
      'previousWorkoutSetsResponseSchema',
      'workoutAnalyticsExerciseResponseSchema',
      'workoutAnalyticsPersonalRecordsResponseSchema',
      'workoutAnalyticsSummaryResponseSchema',
    ] as const) {
      expect(publicApi[key]).toBe(responses[key]);
    }
    expectTypeOf<publicApi.WorkoutActor>().toEqualTypeOf<WorkoutActor>();
  });

  it('keeps strict query contracts and rejects client-controlled owner selection', () => {
    expect(publicApi.workoutAnalyticsQuerySchema.parse({})).toEqual({ range: '30d' });
    expect(
      publicApi.workoutAnalyticsQuerySchema.safeParse({ range: '7d', userId: 'other' }).success,
    ).toBe(false);
    expect(publicApi.previousSetsQuerySchema.safeParse({ userId: 'other' }).success).toBe(false);
    expect(publicApi.previousSetsQuerySchema.parse({})).toEqual({});
  });
});
