import { MODULE_METADATA } from '@nestjs/common/constants';
import { AccountDeletionRequestsModule } from '../../account-deletion-requests.module.js';

describe('AccountDeletionRequestsModule controller registry', () => {
  it('registers no HTTP controllers after audience migration', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AccountDeletionRequestsModule)).toEqual(
      [],
    );
  });
});
