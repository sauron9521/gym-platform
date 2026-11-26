import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { AuthModule } from '../auth.module.js';
import { AdminSessionFacade } from '../public-api.js';
import { AdminCookieAuthService } from '../services/admin-cookie-auth.service.js';
import { PrismaSessionStore, PrismaTokenStore, PrismaMfaStore } from '../stores/index.js';
import { AdminMfaSessionReader } from '../stores/admin-mfa-session-reader.js';
import { TokenCleanupService } from '../services/token-cleanup.service.js';

describe('AuthModule public dependency boundary', () => {
  it('exports only the narrow Admin session command provider, keeping stores and cookie internals private', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AuthModule) as unknown[];
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, AuthModule) as unknown[];
    expect(providers).toContain(AdminSessionFacade);
    expect(exports).toEqual([AdminSessionFacade]);
    for (const internal of [
      PrismaSessionStore,
      PrismaTokenStore,
      PrismaMfaStore,
      AdminCookieAuthService,
      AdminMfaSessionReader,
      TokenCleanupService,
    ]) {
      expect(providers).toContain(internal);
      expect(exports).not.toContain(internal);
    }
  });
});
