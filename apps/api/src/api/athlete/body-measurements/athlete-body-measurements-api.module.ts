import { Module } from '@nestjs/common';
import { BodyMeasurementsModule } from '#src/modules/body-measurements/body-measurements.module';
import { BodyMeasurementsController } from './controllers/body-measurements.controller.js';

@Module({ imports: [BodyMeasurementsModule], controllers: [BodyMeasurementsController] })
export class AthleteBodyMeasurementsApiModule {}
