import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { UsersRepository } from '../repositories/users.repository.js';
import { AvatarSelfFacade } from '../avatar/avatar-self.facade.js';
import { AvatarPublicReadFacade } from '../avatar/avatar-public-read.facade.js';
import { AvatarService } from '../avatar/avatar.service.js';
import { AvatarDiskStorage } from '../avatar/avatar-disk.storage.js';
import { AvatarImageProcessor } from '../avatar/avatar-image.processor.js';
import { AvatarOrphanCleanupService } from '../avatar/avatar-orphan-cleanup.service.js';
import { AdminUsersReadService } from '../services/admin-users-read.service.js';
import { UsersAuthFacade } from '../services/users-auth.facade.js';
import { UsersService } from '../services/users.service.js';
import { UsersModule } from '../users.module.js';

describe('UsersModule public dependency boundary', () => {
  it('provides UsersRepository privately and exports only public services', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, UsersModule) as unknown[];
    const exportedProviders = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      UsersModule,
    ) as unknown[];

    expect(providers).toContain(UsersRepository);
    expect(providers).toContain(AdminUsersReadService);
    expect(exportedProviders).toContain(UsersService);
    expect(exportedProviders).toContain(UsersAuthFacade);
    expect(exportedProviders).toContain(AdminUsersReadService);
    expect(providers).toContain(AvatarSelfFacade);
    expect(exportedProviders).toContain(AvatarSelfFacade);
    expect(providers).toContain(AvatarPublicReadFacade);
    expect(exportedProviders).toContain(AvatarPublicReadFacade);
    for (const internal of [
      UsersRepository,
      AvatarService,
      AvatarDiskStorage,
      AvatarImageProcessor,
      AvatarOrphanCleanupService,
    ]) {
      expect(providers).toContain(internal);
      expect(exportedProviders).not.toContain(internal);
    }
  });
});
