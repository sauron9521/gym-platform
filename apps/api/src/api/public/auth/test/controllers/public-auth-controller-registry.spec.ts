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
import { PublicAuthApiModule } from '../../public-auth-api.module.js';

describe('PublicAuthApiModule controller registry', () => {
  it('owns PasswordResetController and imports the existing AuthModule without registering it twice', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PublicAuthApiModule)).toEqual([
      PasswordResetController,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule)).not.toContain(
      PasswordResetController,
    );
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, PublicAuthApiModule)).toEqual([AuthModule]);
    expect(Reflect.getMetadata(PATH_METADATA, PasswordResetController)).toBe('auth/password-reset');
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
