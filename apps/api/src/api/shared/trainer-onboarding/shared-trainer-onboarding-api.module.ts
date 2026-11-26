import { Module } from '@nestjs/common';
import { TrainerOnboardingModule } from '#src/modules/trainer-onboarding/trainer-onboarding.module';
import { TrainerApplicationsController } from './controllers/trainer-applications.controller.js';

@Module({ imports: [TrainerOnboardingModule], controllers: [TrainerApplicationsController] })
export class SharedTrainerOnboardingApiModule {}
