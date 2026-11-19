import { Module } from '@nestjs/common';

import { TrainerApplicationsController } from './controllers/trainer-applications.controller.js';
import { TrainerApplicationsRepository } from './repositories/trainer-applications.repository.js';
import { TrainerApplicationsService } from './services/trainer-applications.service.js';

@Module({
  controllers: [TrainerApplicationsController],
  providers: [TrainerApplicationsRepository, TrainerApplicationsService],
})
export class TrainerOnboardingModule {}
