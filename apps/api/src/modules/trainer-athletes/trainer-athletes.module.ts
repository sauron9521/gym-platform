import { Module } from '@nestjs/common';

import { UsersModule } from '#src/modules/users/users.module';

import { TrainerAthletesRepository } from './repositories/trainer-athletes.repository.js';
import { TrainerAthletesService } from './services/trainer-athletes.service.js';
import { TrainerAthleteTerminationService } from './services/trainer-athlete-termination.service.js';
import { TrainerAthleteExerciseCopyService } from './services/trainer-athlete-exercise-copy.service.js';
import { TrainerDashboardRepository } from './repositories/trainer-dashboard.repository.js';
import { TrainerDashboardService } from './services/trainer-dashboard.service.js';

@Module({
  imports: [UsersModule],
  controllers: [],
  providers: [
    TrainerAthletesRepository,
    TrainerAthletesService,
    TrainerAthleteTerminationService,
    TrainerAthleteExerciseCopyService,
    TrainerDashboardRepository,
    TrainerDashboardService,
  ],
  exports: [TrainerAthletesService, TrainerDashboardService],
})
export class TrainerAthletesModule {}
