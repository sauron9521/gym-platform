import { Module } from '@nestjs/common';
import { AthleteBodyMeasurementsApiModule } from './body-measurements/athlete-body-measurements-api.module.js';

import { AthleteWorkoutAnalyticsApiModule } from './workout-analytics/athlete-workout-analytics-api.module.js';

@Module({ imports: [AthleteBodyMeasurementsApiModule, AthleteWorkoutAnalyticsApiModule] })
export class AthleteApiModule {}
