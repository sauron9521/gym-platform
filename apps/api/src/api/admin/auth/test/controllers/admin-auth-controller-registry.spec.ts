import { createHash } from 'node:crypto';
import { RequestMethod, type ExecutionContext } from '@nestjs/common';
import type { ThrottlerGenerateKeyFunction } from '@nestjs/throttler';
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  INTERCEPTORS_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { AdminOriginGuard } from '#src/common/auth/admin-origin.guard';
import { AdminSessionPurposeGuard } from '#src/common/auth/admin-session-purpose.guard';
import { ADMIN_COOKIE_ROUTE } from '#src/common/auth/admin-cookie-route';
import { AdminSessionsController } from '../../controllers/admin-sessions.controller.js';
import { AuthModule } from '#src/modules/auth/auth.module';
import { AuthNoStoreInterceptor } from '#src/modules/auth/public-api';
import { AdminAuthController } from '../../controllers/admin-auth.controller.js';
import { AdminAuthApiModule } from '../../admin-auth-api.module.js';

describe('AdminAuthApiModule controller registry', () => {
  it('owns the Admin login route with the existing origin guard, no-store, budget and legacy identity', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AdminAuthApiModule)).toEqual([
      AdminAuthController,
      AdminSessionsController,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AdminAuthApiModule)).toEqual([AuthModule]);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule)).not.toContain(
      AdminAuthController,
    );
    expect(Reflect.getMetadata(PATH_METADATA, AdminAuthController)).toBe('auth');
    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, AdminAuthController)).toContain(
      AuthNoStoreInterceptor,
    );
    expect(Object.getOwnPropertyNames(AdminAuthController.prototype)).toEqual([
      'constructor',
      'adminSignIn',
    ]);
    const handler = Object.getOwnPropertyDescriptor(
      AdminAuthController.prototype,
      'adminSignIn',
    )?.value;
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('admin-login');
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(AdminOriginGuard);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(3);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60_000);
    const generateKey = Reflect.getMetadata(
      'THROTTLER:KEY_GENERATORdefault',
      handler,
    ) as ThrottlerGenerateKeyFunction;
    const moved = {
      getClass: () => class RenamedController {},
      getHandler: () => function renamedHandler() {},
    } as unknown as ExecutionContext;
    for (const tracker of ['127.0.0.1', '2001:db8::1']) {
      expect(generateKey(moved, tracker, 'default')).toBe(
        createHash('sha256').update(`AuthController-adminSignIn-default-${tracker}`).digest('hex'),
      );
    }
  });

  it('owns the three Admin session operations in the Admin leaf', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule)).not.toContain(
      AdminSessionsController,
    );
    expect(Reflect.getMetadata(PATH_METADATA, AdminSessionsController)).toBe('auth');
    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, AdminSessionsController)).toContain(
      AuthNoStoreInterceptor,
    );
    expect(Object.getOwnPropertyNames(AdminSessionsController.prototype)).toEqual([
      'constructor',
      'adminSession',
      'revokeAdminSessions',
      'adminSignOut',
    ]);
  });

  it.each([
    ['adminSession', RequestMethod.GET, 'admin-session', undefined, true],
    ['revokeAdminSessions', RequestMethod.POST, 'admin-sessions/revoke-all', 204, true],
    ['adminSignOut', RequestMethod.POST, 'admin-sign-out', 204, false],
  ] as const)(
    'preserves %s route, guards, cookie marker and inherited rate budget',
    (name, method, path, status, privileged) => {
      const handler = Object.getOwnPropertyDescriptor(
        AdminSessionsController.prototype,
        name,
      )?.value;
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(status);
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual(
        privileged ? [AdminOriginGuard, AdminSessionPurposeGuard] : [AdminOriginGuard],
      );
      expect(Reflect.getMetadata(ADMIN_COOKIE_ROUTE, handler)).toBe(privileged ? true : undefined);
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBeUndefined();
      expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBeUndefined();
      const generateKey = Reflect.getMetadata(
        'THROTTLER:KEY_GENERATORdefault',
        handler,
      ) as ThrottlerGenerateKeyFunction;
      const moved = {
        getClass: () => class RenamedController {},
        getHandler: () => function renamedHandler() {},
      } as unknown as ExecutionContext;
      for (const tracker of ['127.0.0.1', '2001:db8::1']) {
        expect(generateKey(moved, tracker, 'default')).toBe(
          createHash('sha256')
            .update(`SessionsController-${name}-default-${tracker}`)
            .digest('hex'),
        );
      }
    },
  );
});
