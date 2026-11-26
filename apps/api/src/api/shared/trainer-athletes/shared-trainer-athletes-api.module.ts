import { Module } from '@nestjs/common';
import { TrainerAthletesModule } from '#src/modules/trainer-athletes/trainer-athletes.module';
import { TrainerAthletesController } from './controllers/trainer-athletes.controller.js';

@Module({ imports: [TrainerAthletesModule], controllers: [TrainerAthletesController] })
export class SharedTrainerAthletesApiModule {}
