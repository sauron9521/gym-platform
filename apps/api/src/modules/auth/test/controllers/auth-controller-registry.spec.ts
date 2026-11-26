import { MODULE_METADATA } from '@nestjs/common/constants';
import { AuthModule } from '../../auth.module.js';

describe('AuthModule controller registry', () => {
  it('registers no HTTP controllers after the audience migration', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule)).toEqual([]);
  });
});
