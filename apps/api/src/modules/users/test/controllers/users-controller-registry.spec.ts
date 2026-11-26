import { MODULE_METADATA } from '@nestjs/common/constants';

import { UsersModule } from '../../users.module.js';

describe('UsersModule controller registry', () => {
  it('registers no HTTP controllers after the audience migration', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, UsersModule)).toEqual([]);
  });
});
