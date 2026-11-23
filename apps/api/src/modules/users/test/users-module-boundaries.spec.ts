import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { UsersRepository } from '../repositories/users.repository.js';
import { UsersAuthFacade } from '../services/users-auth.facade.js';
import { UsersService } from '../services/users.service.js';
import { UsersModule } from '../users.module.js';

describe('UsersModule public dependency boundary', () => {
  it('provides UsersRepository privately and exports only public services', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, UsersModule) as unknown[];
    const exportedProviders = Reflect.getMetadata(MODULE_METADATA.EXPORTS, UsersModule) as unknown[];

    expect(providers).toContain(UsersRepository);
    expect(exportedProviders).toContain(UsersService);
    expect(exportedProviders).toContain(UsersAuthFacade);
    expect(exportedProviders).not.toContain(UsersRepository);
  });
});
