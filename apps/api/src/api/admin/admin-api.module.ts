import { Module } from '@nestjs/common';

import { AdminAuthApiModule } from './auth/admin-auth-api.module.js';
import { AdminTrainerOnboardingApiModule } from './trainer-onboarding/admin-trainer-onboarding-api.module.js';
import { AdminUsersApiModule } from './users/admin-users-api.module.js';

import { AdminNotificationsApiModule } from './notifications/admin-notifications-api.module.js';

@Module({
  imports: [
    AdminUsersApiModule,
    AdminAuthApiModule,
    AdminTrainerOnboardingApiModule,
    AdminNotificationsApiModule,
  ],
})
export class AdminApiModule {}
