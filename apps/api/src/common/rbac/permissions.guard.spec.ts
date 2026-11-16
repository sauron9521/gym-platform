import { describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import { ADMIN_PERMISSIONS, hasAdminPermission } from './admin-permissions.js';
import { PermissionsGuard } from './permissions.guard.js';

function context(role?: 'ATHLETE' | 'TRAINER' | 'ADMIN'): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
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

  it('fails closed on unknown roles at runtime', () => {
    expect(hasAdminPermission('SUPERADMIN' as 'ADMIN', 'admin.roles.assign')).toBe(false);
  });
});

describe('PermissionsGuard', () => {
  it('allows routes with no explicit permission requirement', () => {
    const reflector = { getAllAndOverride: () => undefined };
    expect(new PermissionsGuard(reflector as never).canActivate(context())).toBe(true);
  });

  it('rejects anonymous and non-admin actors for protected routes', () => {
    const reflector = { getAllAndOverride: () => ['admin.console.read'] };
    const guard = new PermissionsGuard(reflector as never);
    expect(() => guard.canActivate(context())).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context('ATHLETE'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context('TRAINER'))).toThrow(ForbiddenException);
    expect(guard.canActivate(context('ADMIN'))).toBe(true);
  });

  it('never grants role management to current admins', () => {
    const reflector = { getAllAndOverride: () => ['admin.roles.assign'] };
    expect(() => new PermissionsGuard(reflector as never).canActivate(context('ADMIN'))).toThrow(
      ForbiddenException,
    );
  });
});
