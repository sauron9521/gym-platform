import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller.js';
import { AdminUsersController } from './controllers/admin-users.controller.js';
import { AdminUsersReadGuard } from './controllers/admin-users-read.guard.js';
import { AdminAuditModule } from '#src/common/audit/admin-audit.module';
import { AdminSessionPurposeGuard } from '#src/common/auth/admin-session-purpose.guard';
import { AdminOriginGuard } from '#src/common/auth/admin-origin.guard';
import { UsersRepository } from './repositories/users.repository.js';
import { UsersService } from './services/users.service.js';
import { AdminAccountStatusService } from './services/admin-account-status.service.js';
import { AvatarDiskStorage } from './avatar/avatar-disk.storage.js';
import { AvatarService } from './avatar/avatar.service.js';
import { AvatarImageProcessor } from './avatar/avatar-image.processor.js';
import { AvatarOrphanCleanupService } from './avatar/avatar-orphan-cleanup.service.js';
import { AvatarPublicController } from './controllers/avatar-public.controller.js';

@Module({
  imports: [AdminAuditModule],
  providers: [
    AdminUsersReadGuard,
    AdminSessionPurposeGuard,
    AdminOriginGuard,
    UsersRepository,
    UsersService,
    AdminAccountStatusService,
    AvatarService,
    AvatarDiskStorage,
    AvatarImageProcessor,
    AvatarOrphanCleanupService,
  ],
  controllers: [UsersController, AvatarPublicController, AdminUsersController],
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
