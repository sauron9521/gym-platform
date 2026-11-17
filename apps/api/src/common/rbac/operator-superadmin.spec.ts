import { describe, expect, it } from 'vitest';
import { Reflector } from '@nestjs/core';

import { ADMIN_PERMISSIONS, hasAdminPermission } from './admin-permissions.js';
import { PermissionsGuard } from './permissions.guard.js';
import { RequireAdminPermissions } from './permissions.decorator.js';
import { envSchema } from '../config/env.schema.js';

describe('operator-managed super-administrator policy', () => {
  const adminId = 'f09d7567-626e-45d8-99f1-829ce4204fbd';

  it('never elevates a role or unknown permission just because the ID matches', () => {
    const configured = new Set([adminId]);
    for (const permission of ADMIN_PERMISSIONS) {
      expect(hasAdminPermission('ATHLETE', permission, adminId, configured)).toBe(false);
      expect(hasAdminPermission('TRAINER', permission, adminId, configured)).toBe(false);
      expect(hasAdminPermission('ADMIN', permission, 'different-id', configured)).toBe(
        permission === 'admin.console.read',
      );
      expect(hasAdminPermission('ADMIN', permission, adminId, configured)).toBe(true);
    }
    expect(
      hasAdminPermission('ADMIN', 'admin.unknown' as 'admin.console.read', adminId, configured),
    ).toBe(false);
  });

  it('requires explicit, validated environment UUIDs for elevated grants', () => {
    const base = {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/gym',
      JWT_SECRET: 'local-secret',
      JWT_ISSUER: 'http://localhost:3001',
      APP_URL: 'http://localhost:3000',
      CORS_ORIGINS: 'http://localhost:3000',
    };
    expect(envSchema.safeParse({ ...base, SUPERADMIN_USER_IDS: adminId }).success).toBe(true);
    expect(envSchema.safeParse({ ...base, SUPERADMIN_USER_IDS: '*' }).success).toBe(false);
  });

  it('enforces both controller and handler permission checks for an allowlisted admin', () => {
    class AdminController {}
    const handler = () => undefined;
    RequireAdminPermissions('admin.console.read')(AdminController);
    RequireAdminPermissions('admin.roles.assign')(handler);
    const config = { get: () => adminId };
    const guard = new PermissionsGuard(new Reflector(), config as never);
    const context = (id: string, role: string) =>
      ({
        getHandler: () => handler,
        getClass: () => AdminController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { id, role } }),
        }),
      }) as never;
    expect(guard.canActivate(context(adminId, 'ADMIN'))).toBe(true);
    expect(() => guard.canActivate(context('someone-else', 'ADMIN'))).toThrow();
    expect(() => guard.canActivate(context(adminId, 'ATHLETE'))).toThrow();
  });
});
