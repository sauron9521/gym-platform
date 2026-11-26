import { Module } from '@nestjs/common';

import { AdminUsersApiModule } from './users/admin-users-api.module.js';

@Module({ imports: [AdminUsersApiModule] })
export class AdminApiModule {}
