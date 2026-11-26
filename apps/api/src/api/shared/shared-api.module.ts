import { Module } from '@nestjs/common';

import { SharedAccountDeletionRequestsApiModule } from './account-deletion-requests/shared-account-deletion-requests-api.module.js';
import { SharedAuthApiModule } from './auth/shared-auth-api.module.js';
import { SharedNotificationsApiModule } from './notifications/shared-notifications-api.module.js';
import { SharedTrainerOnboardingApiModule } from './trainer-onboarding/shared-trainer-onboarding-api.module.js';
import { SharedUsersApiModule } from './users/shared-users-api.module.js';

@Module({
  imports: [
    SharedUsersApiModule,
    SharedAuthApiModule,
    SharedTrainerOnboardingApiModule,
    SharedNotificationsApiModule,
    SharedAccountDeletionRequestsApiModule,
  ],
})
export class SharedApiModule {}
