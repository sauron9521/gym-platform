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
import { AuthModule } from '#src/modules/auth/auth.module';
import { AuthNoStoreInterceptor } from '#src/modules/auth/public-api';
import { AdminAuthController } from '../../controllers/admin-auth.controller.js';
import { AdminAuthApiModule } from '../../admin-auth-api.module.js';

describe('AdminAuthApiModule controller registry', () => {
  it('owns the Admin login route with the existing origin guard, no-store, budget and legacy identity', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AdminAuthApiModule)).toEqual([
      AdminAuthController,
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
});
