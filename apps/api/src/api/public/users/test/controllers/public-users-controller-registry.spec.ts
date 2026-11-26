import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { UsersModule } from '#src/modules/users/users.module';
import { AvatarPublicController } from '../../controllers/avatar-public.controller.js';
import { PublicUsersApiModule } from '../../public-users-api.module.js';

describe('PublicUsersApiModule controller registry', () => {
  it('owns the avatar controller and imports the existing UsersModule', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PublicUsersApiModule)).toEqual([
      AvatarPublicController,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, UsersModule)).toEqual([]);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, PublicUsersApiModule)).toContain(
      UsersModule,
    );
    expect(Reflect.getMetadata(PATH_METADATA, AvatarPublicController)).toBe('avatars');
    const handler = Object.getOwnPropertyDescriptor(AvatarPublicController.prototype, 'get')?.value;
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(':key');
  });
});
