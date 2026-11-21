import { Module } from '@nestjs/common';

import { AdminAuditModule } from '#src/common/audit/admin-audit.module';

import { TrainerApplicationsController } from './controllers/trainer-applications.controller.js';
import { TrainerReviewController } from './controllers/trainer-review.controller.js';
import { TrainerApplicationsRepository } from './repositories/trainer-applications.repository.js';
import { TrainerReviewRepository } from './repositories/trainer-review.repository.js';
import { TrainerApplicationsService } from './services/trainer-applications.service.js';
import { TrainerReviewService } from './services/trainer-review.service.js';

@Module({
  imports: [AdminAuditModule],
  controllers: [TrainerApplicationsController, TrainerReviewController],
  providers: [
    TrainerApplicationsRepository,
    TrainerApplicationsService,
    TrainerReviewRepository,
    TrainerReviewService,
  ],
})
export class TrainerOnboardingModule {}
