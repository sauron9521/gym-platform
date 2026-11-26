import { Module } from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository.js';
import { AdminUsersReadService } from './services/admin-users-read.service.js';
import { UsersService } from './services/users.service.js';
import { UsersAuthFacade } from './services/users-auth.facade.js';
import { AdminAccountStatusService } from './services/admin-account-status.service.js';
import { AvatarDiskStorage } from './avatar/avatar-disk.storage.js';
import { AvatarService } from './avatar/avatar.service.js';
import { AvatarSelfFacade } from './avatar/avatar-self.facade.js';
import { AvatarImageProcessor } from './avatar/avatar-image.processor.js';
import { AvatarOrphanCleanupService } from './avatar/avatar-orphan-cleanup.service.js';
import { AvatarPublicController } from './controllers/avatar-public.controller.js';

@Module({
  providers: [
    UsersRepository,
    AdminUsersReadService,
    UsersService,
    UsersAuthFacade,
    AdminAccountStatusService,
    AvatarService,
    AvatarSelfFacade,
    AvatarDiskStorage,
    AvatarImageProcessor,
    AvatarOrphanCleanupService,
  ],
  controllers: [AvatarPublicController],
  exports: [UsersService, UsersAuthFacade, AdminUsersReadService, AvatarSelfFacade],
})
export class UsersModule {}
