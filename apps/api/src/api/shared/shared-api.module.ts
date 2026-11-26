import { Module } from '@nestjs/common';

import { SharedAuthApiModule } from './auth/shared-auth-api.module.js';
import { SharedUsersApiModule } from './users/shared-users-api.module.js';

@Module({ imports: [SharedUsersApiModule, SharedAuthApiModule] })
export class SharedApiModule {}
