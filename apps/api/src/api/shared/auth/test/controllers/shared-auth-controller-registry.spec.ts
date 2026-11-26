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
import { AuthModule } from '#src/modules/auth/auth.module';
import {
  AuthNoStoreInterceptor,
  VerificationResendRateLimitGuard,
} from '#src/modules/auth/public-api';
import { EmailVerificationResendController } from '../../controllers/email-verification-resend.controller.js';
import { SharedAuthApiModule } from '../../shared-auth-api.module.js';
import { SessionsController } from '../../controllers/sessions.controller.js';
import * as historicalBarrel from '../../controllers/index.js';

describe('SharedAuthApiModule controller registry', () => {
  it('owns authenticated email resend and sessions and preserves the legacy resend counter', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, SharedAuthApiModule)).toEqual([
      EmailVerificationResendController,
      SessionsController,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, SharedAuthApiModule)).toEqual([AuthModule]);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule)).not.toContain(
      EmailVerificationResendController,
    );
    expect(Reflect.getMetadata(PATH_METADATA, EmailVerificationResendController)).toBe(
      'auth/email',
    );
    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, EmailVerificationResendController)).toContain(
      AuthNoStoreInterceptor,
    );
    expect(Object.getOwnPropertyNames(EmailVerificationResendController.prototype)).toEqual([
      'constructor',
      'resend',
    ]);
    const handler = Object.getOwnPropertyDescriptor(
      EmailVerificationResendController.prototype,
      'resend',
    )?.value;
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('verification');
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(202);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(3);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60_000);
    const key = Reflect.getMetadata(
      'THROTTLER:KEY_GENERATORdefault',
      handler,
    ) as ThrottlerGenerateKeyFunction;
    const moved = {
      getClass: () => class RenamedController {},
      getHandler: () => function renamedHandler() {},
    } as unknown as ExecutionContext;
    for (const tracker of ['127.0.0.1', '2001:db8::1']) {
      expect(key(moved, tracker, 'default')).toBe(
        createHash('sha256')
          .update(`EmailVerificationController-resend-default-${tracker}`)
          .digest('hex'),
      );
    }
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(
      VerificationResendRateLimitGuard,
    );
  });

  it('owns three authenticated session routes and preserves the relocated barrel without inward exports', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule)).toEqual([]);
    expect(Reflect.getMetadata(PATH_METADATA, SessionsController)).toBe('auth');
    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, SessionsController)).toContain(
      AuthNoStoreInterceptor,
    );
    expect(Object.getOwnPropertyNames(SessionsController.prototype)).toEqual([
      'constructor',
      'list',
      'revoke',
      'signOutEverywhere',
    ]);
    expect(Object.keys(historicalBarrel)).toEqual(['SessionsController']);
    expect(historicalBarrel.SessionsController).toBe(SessionsController);
  });

  it.each([
    ['list', RequestMethod.GET, 'sessions', undefined],
    ['revoke', RequestMethod.DELETE, 'sessions/:id', 204],
    ['signOutEverywhere', RequestMethod.POST, 'sign-out-everywhere', 204],
  ] as const)(
    'preserves %s route, response status and inherited rate budget',
    (name, method, path, status) => {
      const handler = Object.getOwnPropertyDescriptor(SessionsController.prototype, name)?.value;
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(status);
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
