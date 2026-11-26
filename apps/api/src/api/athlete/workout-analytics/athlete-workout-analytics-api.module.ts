import { Module } from '@nestjs/common';
import { WorkoutAnalyticsModule } from '#src/modules/workout-analytics/workout-analytics.module';
import { WorkoutAnalyticsController } from './controllers/workout-analytics.controller.js';

@Module({ imports: [WorkoutAnalyticsModule], controllers: [WorkoutAnalyticsController] })
export class AthleteWorkoutAnalyticsApiModule {}
