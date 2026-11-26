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

describe('SharedAuthApiModule controller registry', () => {
  it('owns only authenticated email resend and preserves the legacy counter', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, SharedAuthApiModule)).toEqual([
      EmailVerificationResendController,
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
});
