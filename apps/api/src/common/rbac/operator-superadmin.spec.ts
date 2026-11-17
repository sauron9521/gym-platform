import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { envSchema } from '../config/env.schema.js';
import { ADMIN_PERMISSIONS, hasAdminPermission } from './admin-permissions.js';
import {
  isValidOperatorSuperAdminIds,
  parseOperatorSuperAdminIds,
} from './operator-superadmin-allowlist.js';
import { RequireAdminPermissions } from './permissions.decorator.js';
import { PermissionsGuard } from './permissions.guard.js';

const first = 'f09d7567-626e-45d8-99f1-829ce4204fbd';
const second = 'd09c7567-626e-45d8-99f1-829ce4204fbd';

function requestContext(role?: 'ADMIN' | 'ATHLETE' | 'TRAINER', id?: string): ExecutionContext {
  class AdminController {}
  const handler = () => undefined;
  RequireAdminPermissions('admin.console.read')(AdminController);
  RequireAdminPermissions('admin.roles.assign')(handler);

  return {
    getHandler: () => handler,
    getClass: () => AdminController,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role, id } : undefined }) }),
  } as unknown as ExecutionContext;
}

function createGuard(raw?: string): PermissionsGuard {
  const config = { get: () => raw };
  return new PermissionsGuard(new Reflector(), config as never);
}

describe('operator-configured Super-admin permission policy', () => {
  it('defaults to no elevation without an explicit validated list', () => {
    expect(parseOperatorSuperAdminIds(undefined).size).toBe(0);
    expect(parseOperatorSuperAdminIds('').size).toBe(0);
    expect(hasAdminPermission('ADMIN', 'admin.console.read')).toBe(true);
    expect(hasAdminPermission('ADMIN', 'admin.roles.assign')).toBe(false);
    expect(() => createGuard().canActivate(requestContext('ADMIN', first))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects ALL elevations on partial corruption, duplicates or wildcards', () => {
    for (const value of [
      '*',
      first + ',*',
      first + ',',
      first + ',' + first.toUpperCase(),
      'not-an-id',
      first + ',not-an-id',
      Array.from({ length: 21 }, () => first).join(','),
      first + ' '.repeat(1100),
    ]) {
      expect(parseOperatorSuperAdminIds(value).size).toBe(0);
      expect(isValidOperatorSuperAdminIds(value)).toBe(false);
      expect(() => createGuard(value).canActivate(requestContext('ADMIN', first))).toThrow(
        ForbiddenException,
      );
    }
  });

  it('allows only existing ADMIN role principals explicitly listed by UUID', () => {
    const elevated = parseOperatorSuperAdminIds(first + ', ' + second);
    expect(elevated.size).toBe(2);
    for (const permission of ADMIN_PERMISSIONS) {
      expect(hasAdminPermission('ADMIN', permission, first, elevated)).toBe(true);
      expect(hasAdminPermission('ADMIN', permission, second, elevated)).toBe(true);
      expect(hasAdminPermission('ATHLETE', permission, first, elevated)).toBe(false);
      expect(hasAdminPermission('TRAINER', permission, first, elevated)).toBe(false);
      expect(hasAdminPermission('ADMIN', permission, 'unknown', elevated)).toBe(
        permission === 'admin.console.read',
      );
    }
    expect(hasAdminPermission('ADMIN', 'admin.invalid' as 'admin.roles.assign', first, elevated)).toBe(
      false,
    );
  });

  it('enforces both class- and handler-level requirements for the actual principal', () => {
    const guard = createGuard(first);
    expect(guard.canActivate(requestContext('ADMIN', first))).toBe(true);
    expect(() => guard.canActivate(requestContext('ADMIN', second))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(requestContext('ATHLETE', first))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(requestContext('TRAINER', first))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(requestContext(undefined, first))).toThrow(ForbiddenException);
  });

  it('validates operator settings during boot and rejects malformed lists', () => {
    const base = {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/gym',
      JWT_SECRET: 'test-secret',
      JWT_ISSUER: 'http://localhost:3001',
      APP_URL: 'http://localhost:3000',
      CORS_ORIGINS: 'http://localhost:3000',
    };

    expect(envSchema.safeParse({ ...base, SUPERADMIN_USER_IDS: '' }).success).toBe(true);
    expect(envSchema.safeParse({ ...base, SUPERADMIN_USER_IDS: first }).success).toBe(true);
    expect(
      envSchema.safeParse({ ...base, SUPERADMIN_USER_IDS: first + ', ' + second }).success,
    ).toBe(true);
    for (const invalid of ['*', first + ',bogus', first + ',' + first]) {
      expect(envSchema.safeParse({ ...base, SUPERADMIN_USER_IDS: invalid }).success).toBe(false);
    }
  });
});
