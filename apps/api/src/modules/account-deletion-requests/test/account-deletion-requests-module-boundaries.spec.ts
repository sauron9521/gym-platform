import { MODULE_METADATA } from '@nestjs/common/constants';
import { RateLimitStorageModule } from '#src/common/rate-limit/rate-limit-storage.module';
import { AccountDeletionRequestsModule } from '../account-deletion-requests.module.js';
import * as publicApi from '../public-api.js';
import { AccountDeletionRequestsRepository } from '../repositories/account-deletion-requests.repository.js';
import { accountDeletionRequestSchema } from '../dto/account-deletion-request.dto.js';

describe('AccountDeletionRequestsModule public boundary', () => {
  it('exports only the existing intake service and retains private persistence and the quota dependency', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AccountDeletionRequestsModule)).toEqual([
      AccountDeletionRequestsRepository,
      publicApi.AccountDeletionRequestsService,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, AccountDeletionRequestsModule)).toEqual([
      publicApi.AccountDeletionRequestsService,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AccountDeletionRequestsModule)).toEqual([
      RateLimitStorageModule,
    ]);
  });

  it('exposes only the existing owner-scoped use cases and the confirmation schema', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'AccountDeletionRequestsService',
      'accountDeletionRequestSchema',
    ]);
    expect(publicApi.accountDeletionRequestSchema).toBe(accountDeletionRequestSchema);
    expect(Object.getOwnPropertyNames(publicApi.AccountDeletionRequestsService.prototype)).toEqual([
      'constructor',
      'findOwn',
      'submit',
    ]);
  });

  it.each([
    { confirm: false, password: 'test-password' },
    { confirm: true, password: '   ' },
    { confirm: true, password: 'test-password', totpCode: '12345' },
    { confirm: true, password: 'test-password', userId: 'other' },
    { confirm: true, password: 'test-password', passwordHash: 'hash' },
  ])('rejects malformed or foreign confirmation fields', (input) => {
    expect(publicApi.accountDeletionRequestSchema.safeParse(input).success).toBe(false);
  });
});
