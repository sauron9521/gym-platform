import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { UsersModule } from '#src/modules/users/users.module';
import { AdminUsersApiModule } from '../../admin-users-api.module.js';
import { AdminUsersController } from '../../controllers/admin-users.controller.js';
import { AdminUsersReadGuard } from '../../controllers/admin-users-read.guard.js';

describe('AdminUsersApiModule controller registry', () => {
  it('owns the directory controller exactly once and imports its feature provider', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AdminUsersApiModule)).toEqual([
      AdminUsersController,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, UsersModule)).not.toContain(
      AdminUsersController,
    );
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AdminUsersApiModule)).toContain(
      UsersModule,
    );
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AdminUsersApiModule)).toContain(
      AdminUsersReadGuard,
    );
    expect(Reflect.getMetadata(PATH_METADATA, AdminUsersController)).toBe('admin/users');
  });

  it.each([
    ['list', '/'],
    ['detail', ':userId'],
  ] as const)('preserves GET %s route metadata', (method, path) => {
    const handler = Object.getOwnPropertyDescriptor(AdminUsersController.prototype, method)?.value;
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
  });
});
