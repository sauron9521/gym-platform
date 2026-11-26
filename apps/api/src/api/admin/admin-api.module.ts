import { Module } from '@nestjs/common';

import { AdminAuthApiModule } from './auth/admin-auth-api.module.js';
import { AdminUsersApiModule } from './users/admin-users-api.module.js';

@Module({ imports: [AdminUsersApiModule, AdminAuthApiModule] })
export class AdminApiModule {}
