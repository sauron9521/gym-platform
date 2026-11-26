import { Module } from '@nestjs/common';
import { TrainerOnboardingModule } from '#src/modules/trainer-onboarding/trainer-onboarding.module';
import { TrainerReviewController } from './controllers/trainer-review.controller.js';

@Module({ imports: [TrainerOnboardingModule], controllers: [TrainerReviewController] })
export class AdminTrainerOnboardingApiModule {}
