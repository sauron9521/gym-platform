import { Module } from '@nestjs/common';

import { UsersModule } from '#src/modules/users/users.module';

import { WorkoutAnalyticsRepository } from './repositories/workout-analytics.repository.js';
import { WorkoutAnalyticsService } from './services/workout-analytics.service.js';

@Module({
  imports: [UsersModule],
  controllers: [],
  providers: [WorkoutAnalyticsRepository, WorkoutAnalyticsService],
  exports: [WorkoutAnalyticsService],
})
export class WorkoutAnalyticsModule {}
