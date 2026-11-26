import { Module } from '@nestjs/common';

import { AdminAuditModule } from '#src/common/audit/admin-audit.module';
import { AdminSessionPurposeGuard } from '#src/common/auth/admin-session-purpose.guard';
import { AdminOriginGuard } from '#src/common/auth/admin-origin.guard';

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
    AdminSessionPurposeGuard,
    AdminOriginGuard,
    TrainerApplicationsRepository,
    TrainerApplicationsService,
    TrainerReviewRepository,
    TrainerReviewService,
  ],
  exports: [TrainerApplicationsService, TrainerReviewService],
})
export class TrainerOnboardingModule {}
