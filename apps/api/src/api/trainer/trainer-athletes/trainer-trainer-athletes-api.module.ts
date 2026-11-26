import { Module } from '@nestjs/common';
import { TrainerAthletesModule } from '#src/modules/trainer-athletes/trainer-athletes.module';
import { TrainerDashboardController } from './controllers/trainer-dashboard.controller.js';

@Module({ imports: [TrainerAthletesModule], controllers: [TrainerDashboardController] })
export class TrainerTrainerAthletesApiModule {}
