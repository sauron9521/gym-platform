import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { AvatarPublicController } from '../../controllers/avatar-public.controller.js';
import { UsersModule } from '../../users.module.js';

describe('UsersModule controller registry', () => {
  it('registers only the remaining legacy public avatar controller', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, UsersModule)).toEqual([
      AvatarPublicController,
    ]);
    expect(Reflect.getMetadata(PATH_METADATA, AvatarPublicController)).toBe('avatars');
    const handler = Object.getOwnPropertyDescriptor(AvatarPublicController.prototype, 'get')?.value;
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(':key');
  });
});
