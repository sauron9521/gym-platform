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
  AccountRecoveryRateLimitGuard,
  AuthNoStoreInterceptor,
} from '#src/modules/auth/public-api';
import { PasswordResetController } from '../../controllers/password-reset.controller.js';
import { TokensController } from '../../controllers/tokens.controller.js';
import { EmailVerificationController } from '../../controllers/email-verification.controller.js';
import { PublicAuthApiModule } from '../../public-auth-api.module.js';

describe('PublicAuthApiModule controller registry', () => {
  it('owns all three public controllers and imports the existing AuthModule without registering it twice', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PublicAuthApiModule)).toEqual([
      PasswordResetController,
      TokensController,
      EmailVerificationController,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule)).not.toContain(
      PasswordResetController,
    );
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, PublicAuthApiModule)).toEqual([AuthModule]);
    expect(Reflect.getMetadata(PATH_METADATA, PasswordResetController)).toBe('auth/password-reset');
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule)).not.toContain(
      TokensController,
    );
    expect(Reflect.getMetadata(PATH_METADATA, TokensController)).toBe('auth/token');
    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, TokensController)).toContain(
      AuthNoStoreInterceptor,
    );
    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, PasswordResetController)).toContain(
      AuthNoStoreInterceptor,
    );
  });

  it.each([
    ['forgot', 202],
    ['reset', 200],
  ] as const)(
    'preserves %s HTTP method, status, budget and original counter identity',
    (name, code) => {
      const handler = Object.getOwnPropertyDescriptor(
        PasswordResetController.prototype,
        name,
      )?.value;
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(name);
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(code);
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(3);
      expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60_000);
      const generateKey = Reflect.getMetadata(
        'THROTTLER:KEY_GENERATORdefault',
        handler,
      ) as ThrottlerGenerateKeyFunction;
      expect(generateKey).toBeTypeOf('function');
      const moved = {
        getClass: () => class RenamedController {},
        getHandler: () => function renamedHandler() {},
      } as unknown as ExecutionContext;
      for (const tracker of ['127.0.0.1', '2001:db8::1']) {
        const expected = createHash('sha256')
          .update(`PasswordResetController-${name}-default-${tracker}`)
          .digest('hex');
        expect(generateKey(moved, tracker, 'default')).toBe(expected);
      }
    },
  );

  it.each([
    ['issue', '/', 200, 3],
    ['refresh', 'refresh', 200, 20],
    ['revoke', 'revoke', 204, 10],
  ] as const)(
    'preserves token %s method, path, status, budget and counter identity',
    (name, path, status, limit) => {
      const handler = Object.getOwnPropertyDescriptor(TokensController.prototype, name)?.value;
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(status);
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(limit);
      expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60_000);
      const generateKey = Reflect.getMetadata(
        'THROTTLER:KEY_GENERATORdefault',
        handler,
      ) as ThrottlerGenerateKeyFunction;
      expect(generateKey).toBeTypeOf('function');
      const moved = {
        getClass: () => class RenamedController {},
        getHandler: () => function renamedHandler() {},
      } as unknown as ExecutionContext;
      for (const tracker of ['127.0.0.1', '2001:db8::1']) {
        expect(generateKey(moved, tracker, 'default')).toBe(
          createHash('sha256').update(`TokensController-${name}-default-${tracker}`).digest('hex'),
        );
      }
    },
  );

  it('preserves public verification ownership, no-store, route and legacy counter', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule)).not.toContain(
      EmailVerificationController,
    );
    expect(Reflect.getMetadata(PATH_METADATA, EmailVerificationController)).toBe('auth/email');
    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, EmailVerificationController)).toContain(
      AuthNoStoreInterceptor,
    );
    expect(Object.getOwnPropertyNames(EmailVerificationController.prototype)).toEqual([
      'constructor',
      'verifyEmail',
    ]);
    const handler = Object.getOwnPropertyDescriptor(
      EmailVerificationController.prototype,
      'verifyEmail',
    )?.value;
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('verify');
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(8);
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
          .update(`EmailVerificationController-verifyEmail-default-${tracker}`)
          .digest('hex'),
      );
    }
  });

  it('retains the secondary account guard only on forgot', () => {
    const forgot = Object.getOwnPropertyDescriptor(
      PasswordResetController.prototype,
      'forgot',
    )?.value;
    const reset = Object.getOwnPropertyDescriptor(
      PasswordResetController.prototype,
      'reset',
    )?.value;
    expect(Reflect.getMetadata(GUARDS_METADATA, forgot)).toContain(AccountRecoveryRateLimitGuard);
    expect(Reflect.getMetadata(GUARDS_METADATA, reset) ?? []).not.toContain(
      AccountRecoveryRateLimitGuard,
    );
  });
});
