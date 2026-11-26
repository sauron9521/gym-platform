import { RateLimit } from '#src/common/rate-limit/rate-limit.policies';
import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import type { WorkoutActor } from '#src/modules/workouts/types/workout.types';

import {
  analyticsExerciseIdSchema,
  previousSetsQuerySchema,
  workoutAnalyticsQuerySchema,
  type WorkoutAnalyticsQuery,
} from '../dto/workout-analytics.schemas.js';
import {
  previousWorkoutSetsResponseSchema,
  workoutAnalyticsExerciseResponseSchema,
  workoutAnalyticsPersonalRecordsResponseSchema,
  workoutAnalyticsSummaryResponseSchema,
} from '../workout-analytics.responses.js';
import { WorkoutAnalyticsService } from '../services/workout-analytics.service.js';

@Authenticate()
@ApiTags('Workout Analytics')
@ApiCookieAuth('sessionCookie')
@ApiBearerAuth('accessToken')
@Controller('workout-analytics')
export class WorkoutAnalyticsController {
  constructor(private readonly service: WorkoutAnalyticsService) {}

  @RateLimit('analytics')
  @Get('summary')
  @ApiOkResponse({ schema: workoutAnalyticsSummaryResponseSchema })
  summary(
    @CurrentUser() actor: WorkoutActor,
    @Query({ schema: workoutAnalyticsQuerySchema }) query: WorkoutAnalyticsQuery,
  ) {
    return this.service.summary(actor, query);
  }

  @RateLimit('analytics')
  @Get('personal-records')
  @ApiOkResponse({ schema: workoutAnalyticsPersonalRecordsResponseSchema })
  personalRecords(@CurrentUser() actor: WorkoutActor) {
    return this.service.personalRecords(actor);
  }

  @RateLimit('analytics')
  @Get('exercises/:exerciseId/previous-sets')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: previousWorkoutSetsResponseSchema })
  previousSets(
    @CurrentUser() actor: WorkoutActor,
    @Param('exerciseId', { schema: analyticsExerciseIdSchema }) exerciseId: string,
    @Query({ schema: previousSetsQuerySchema }) _query: Record<string, never>,
  ) {
    return this.service.previousSets(actor, exerciseId);
  }

  @RateLimit('analytics')
  @Get('exercises/:exerciseId')
  @ApiOkResponse({ schema: workoutAnalyticsExerciseResponseSchema })
  exercise(
    @CurrentUser() actor: WorkoutActor,
    @Param('exerciseId', { schema: analyticsExerciseIdSchema }) exerciseId: string,
    @Query({ schema: workoutAnalyticsQuerySchema }) query: WorkoutAnalyticsQuery,
  ) {
    return this.service.exercise(actor, exerciseId, query);
  }
}
