import { Module } from '@nestjs/common';

import { AdminAuditModule } from '#src/common/audit/admin-audit.module';

import { TrainerApplicationsController } from './controllers/trainer-applications.controller.js';
import { TrainerApplicationsRepository } from './repositories/trainer-applications.repository.js';
import { TrainerReviewRepository } from './repositories/trainer-review.repository.js';
import { TrainerApplicationsService } from './services/trainer-applications.service.js';
import { TrainerReviewService } from './services/trainer-review.service.js';

@Module({
  imports: [AdminAuditModule],
  controllers: [TrainerApplicationsController],
  providers: [
    TrainerApplicationsRepository,
    TrainerApplicationsService,
    TrainerReviewRepository,
    TrainerReviewService,
  ],
  exports: [TrainerApplicationsService, TrainerReviewService],
})
export class TrainerOnboardingModule {}
