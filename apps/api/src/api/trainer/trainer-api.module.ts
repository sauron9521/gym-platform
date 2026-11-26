import { Module } from '@nestjs/common';
import { TrainerTrainerAthletesApiModule } from './trainer-athletes/trainer-trainer-athletes-api.module.js';

@Module({ imports: [TrainerTrainerAthletesApiModule] })
export class TrainerApiModule {}
