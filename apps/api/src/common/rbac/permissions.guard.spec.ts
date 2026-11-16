import { describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ADMIN_PERMISSIONS, hasAdminPermission } from './admin-permissions.js';
import { RequireAdminPermissions } from './permissions.decorator.js';
import { PermissionsGuard } from './permissions.guard.js';

type Role = 'ATHLETE' | 'TRAINER' | 'ADMIN';

function context(
  role?: Role,
  controller: Function = class {},
  handler: Function = () => undefined,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('Admin permission registry', () => {
  it('explicitly denies elevated operations to every current role', () => {
    for (const permission of ADMIN_PERMISSIONS) {
      expect(hasAdminPermission('ATHLETE', permission)).toBe(false);
      expect(hasAdminPermission('TRAINER', permission)).toBe(false);
      expect(hasAdminPermission('ADMIN', permission)).toBe(permission === 'admin.console.read');
    }
  });

  it('fails closed on unknown roles and unknown permissions at runtime', () => {
    expect(hasAdminPermission('SUPERADMIN' as 'ADMIN', 'admin.roles.assign')).toBe(false);
    expect(hasAdminPermission('ADMIN', 'admin.unknown' as 'admin.console.read')).toBe(false);
  });
});

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  it('keeps existing undecorated routes unchanged', () => {
    expect(guard.canActivate(context())).toBe(true);
  });

  it('requires authenticated ADMIN for console access at controller level', () => {
    class AdminController {}
    RequireAdminPermissions('admin.console.read')(AdminController);

    expect(() => guard.canActivate(context(undefined, AdminController))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context('ATHLETE', AdminController))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context('TRAINER', AdminController))).toThrow(ForbiddenException);
    expect(guard.canActivate(context('ADMIN', AdminController))).toBe(true);
  });

  it('requires authenticated ADMIN for console access at handler level', () => {
    const handler = () => undefined;
    RequireAdminPermissions('admin.console.read')(handler);

    expect(() => guard.canActivate(context('ATHLETE', class {}, handler))).toThrow(ForbiddenException);
    expect(guard.canActivate(context('ADMIN', class {}, handler))).toBe(true);
  });

  it('combines class-level and method-level permissions instead of overriding', () => {
    class AdminController {}
    const handler = () => undefined;
    RequireAdminPermissions('admin.roles.assign')(AdminController);
    RequireAdminPermissions('admin.console.read')(handler);

    // A method-level read grant must not replace the class-wide role management restriction.
    expect(() => guard.canActivate(context('ADMIN', AdminController, handler))).toThrow(
      ForbiddenException,
    );
  });

  it('never grants role management to current admins', () => {
    const handler = () => undefined;
    RequireAdminPermissions('admin.roles.assign')(handler);

    expect(() => guard.canActivate(context('ADMIN', class {}, handler))).toThrow(
      ForbiddenException,
    );
  });

  it('denies empty permission decorators, including a method under an allowed class', () => {
    class AdminController {}
    const handler = () => undefined;
    RequireAdminPermissions('admin.console.read')(AdminController);
    RequireAdminPermissions()(handler);

    expect(() => guard.canActivate(context('ADMIN', AdminController, handler))).toThrow(
      ForbiddenException,
    );

    const emptyOnly = () => undefined;
    RequireAdminPermissions()(emptyOnly);
    expect(() => guard.canActivate(context('ADMIN', class {}, emptyOnly))).toThrow(
      ForbiddenException,
    );
  });
});
