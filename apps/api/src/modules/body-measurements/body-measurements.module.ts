import { Module } from '@nestjs/common';

import { BodyMeasurementsRepository } from './repositories/body-measurements.repository.js';
import { BodyMeasurementsService } from './services/body-measurements.service.js';
import { BodyMeasurementStatisticsService } from './services/body-measurement-statistics.service.js';
import { BodyMeasurementStatisticsRepository } from './repositories/body-measurement-statistics.repository.js';

@Module({
  controllers: [],
  providers: [
    BodyMeasurementsRepository,
    BodyMeasurementsService,
    BodyMeasurementStatisticsRepository,
    BodyMeasurementStatisticsService,
  ],
  exports: [BodyMeasurementsService, BodyMeasurementStatisticsService],
})
export class BodyMeasurementsModule {}
