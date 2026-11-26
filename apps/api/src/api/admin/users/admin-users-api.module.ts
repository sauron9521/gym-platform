import { Module } from '@nestjs/common';

import { AdminAuditModule } from '#src/common/audit/admin-audit.module';
import { AdminOriginGuard } from '#src/common/auth/admin-origin.guard';
import { AdminSessionPurposeGuard } from '#src/common/auth/admin-session-purpose.guard';
import { UsersModule } from '#src/modules/users/users.module';

import { AdminUsersController } from './controllers/admin-users.controller.js';
import { AdminUsersReadGuard } from './controllers/admin-users-read.guard.js';

@Module({
  imports: [UsersModule, AdminAuditModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersReadGuard, AdminOriginGuard, AdminSessionPurposeGuard],
})
export class AdminUsersApiModule {}
