import { Module } from '@nestjs/common';

import { AdminAuthApiModule } from './auth/admin-auth-api.module.js';
import { AdminTrainerOnboardingApiModule } from './trainer-onboarding/admin-trainer-onboarding-api.module.js';
import { AdminUsersApiModule } from './users/admin-users-api.module.js';

@Module({ imports: [AdminUsersApiModule, AdminAuthApiModule, AdminTrainerOnboardingApiModule] })
export class AdminApiModule {}
