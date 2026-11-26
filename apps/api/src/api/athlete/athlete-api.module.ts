import { Module } from '@nestjs/common';
import { AthleteBodyMeasurementsApiModule } from './body-measurements/athlete-body-measurements-api.module.js';

@Module({ imports: [AthleteBodyMeasurementsApiModule] })
export class AthleteApiModule {}
