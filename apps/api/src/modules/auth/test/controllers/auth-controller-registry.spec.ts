import { createHash } from 'node:crypto';

import { RequestMethod, type ExecutionContext } from '@nestjs/common';
import type { ThrottlerGenerateKeyFunction } from '@nestjs/throttler';
import {
  HTTP_CODE_METADATA,
  INTERCEPTORS_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';

import { AuthController } from '../../controllers/auth.controller.js';
import { EmailVerificationController } from '../../controllers/email-verification.controller.js';
import { TokensController } from '../../controllers/tokens.controller.js';
import { SessionsController } from '../../controllers/sessions.controller.js';
import { AuthNoStoreInterceptor } from '../../interceptors/auth-no-store.interceptor.js';
import { AuthModule } from '../../auth.module.js';

describe('AuthModule controller registry', () => {
  const controllers = [
    AuthController,
    EmailVerificationController,
    TokensController,
    SessionsController,
  ];

  it('preserves controller registration and four remaining legacy route prefixes', () => {
    const registered: unknown[] = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule);
    expect(registered).toEqual(controllers);
    expect(controllers.map((controller) => Reflect.getMetadata(PATH_METADATA, controller))).toEqual(
      ['auth', 'auth/email', 'auth/token', 'auth'],
    );
  });

  it.each([
    [AuthController, 'signUp', RequestMethod.POST, 'register', undefined],
    [AuthController, 'signIn', RequestMethod.POST, 'login', 200],
    [AuthController, 'adminSignIn', RequestMethod.POST, 'admin-login', 200],
    [EmailVerificationController, 'verifyEmail', RequestMethod.POST, 'verify', 200],
    [EmailVerificationController, 'resend', RequestMethod.POST, 'verification', 202],
    [TokensController, 'issue', RequestMethod.POST, '/', 200],
    [TokensController, 'refresh', RequestMethod.POST, 'refresh', 200],
    [TokensController, 'revoke', RequestMethod.POST, 'revoke', 204],
    [SessionsController, 'adminSession', RequestMethod.GET, 'admin-session', undefined],
    [
      SessionsController,
      'revokeAdminSessions',
      RequestMethod.POST,
      'admin-sessions/revoke-all',
      204,
    ],
    [SessionsController, 'list', RequestMethod.GET, 'sessions', undefined],
    [SessionsController, 'revoke', RequestMethod.DELETE, 'sessions/:id', 204],
    [SessionsController, 'signOut', RequestMethod.POST, 'sign-out', 204],
    [SessionsController, 'adminSignOut', RequestMethod.POST, 'admin-sign-out', 204],
    [SessionsController, 'signOutEverywhere', RequestMethod.POST, 'sign-out-everywhere', 204],
  ] as const)('preserves %s.%s HTTP contract', (controller, name, method, path, code) => {
    const handler = Object.getOwnPropertyDescriptor(controller.prototype, name)?.value as (
      ...args: unknown[]
    ) => unknown;

    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(code);
  });

  it.each([
    [AuthController, 'signUp', 3],
    [AuthController, 'signIn', 3],
    [AuthController, 'adminSignIn', 3],
    [EmailVerificationController, 'verifyEmail', 8],
    [EmailVerificationController, 'resend', 3],
    [TokensController, 'issue', 3],
    [TokensController, 'refresh', 20],
    [TokensController, 'revoke', 10],
  ] as const)('retains %s.%s rate limit', (controller, name, limit) => {
    const handler = Object.getOwnPropertyDescriptor(controller.prototype, name)?.value as (
      ...args: unknown[]
    ) => unknown;

    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(limit);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60_000);
  });

  it.each([
    [AuthController, 'signUp', 'AuthController-signUp'],
    [AuthController, 'adminSignIn', 'AuthController-adminSignIn'],
    [AuthController, 'signIn', 'AuthController-signIn'],
    [EmailVerificationController, 'verifyEmail', 'EmailVerificationController-verifyEmail'],
    [EmailVerificationController, 'resend', 'EmailVerificationController-resend'],
    [TokensController, 'issue', 'TokensController-issue'],
    [TokensController, 'refresh', 'TokensController-refresh'],
    [TokensController, 'revoke', 'TokensController-revoke'],
    [SessionsController, 'adminSession', 'SessionsController-adminSession'],
    [SessionsController, 'revokeAdminSessions', 'SessionsController-revokeAdminSessions'],
    [SessionsController, 'adminSignOut', 'SessionsController-adminSignOut'],
    [SessionsController, 'list', 'SessionsController-list'],
    [SessionsController, 'revoke', 'SessionsController-revoke'],
    [SessionsController, 'signOut', 'SessionsController-signOut'],
    [SessionsController, 'signOutEverywhere', 'SessionsController-signOutEverywhere'],
  ] as const)(
    'retains the original throttle identity for %s.%s',
    (controller, method, identity) => {
      const handler = Object.getOwnPropertyDescriptor(controller.prototype, method)?.value;
      const generateKey = Reflect.getMetadata('THROTTLER:KEY_GENERATORdefault', handler) as
        ThrottlerGenerateKeyFunction | undefined;
      expect(generateKey).toBeTypeOf('function');
      // Even if Nest reports a different class or method name after relocation,
      // existing buckets remain identical for the tracker and throttler name.
      const moved = {
        getClass: () => class RenamedController {},
        getHandler: () => function renamedHandler() {},
      } as unknown as ExecutionContext;
      for (const tracker of ['127.0.0.1', '2001:db8::1']) {
        const expected = createHash('sha256')
          .update(`${identity}-default-${tracker}`)
          .digest('hex');
        expect(generateKey!(moved, tracker, 'default')).toBe(expected);
      }
    },
  );

  it('retains the no-store interceptor on all four remaining controllers', () => {
    for (const controller of controllers) {
      const interceptors: unknown[] = Reflect.getMetadata(INTERCEPTORS_METADATA, controller);
      expect(interceptors).toContain(AuthNoStoreInterceptor);
    }
  });

  it('registers exactly fifteen unique HTTP verb/path pairs', () => {
    const routes = controllers.flatMap((controller) => {
      const prefix = Reflect.getMetadata(PATH_METADATA, controller) as string;
      return Object.getOwnPropertyNames(controller.prototype)
        .filter((name) => name !== 'constructor')
        .map((name) => {
          const handler = Object.getOwnPropertyDescriptor(controller.prototype, name)?.value as (
            ...args: unknown[]
          ) => unknown;
          const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
          const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
          expect(method, `Missing HTTP method on ${controller.name}.${name}`).toBeDefined();
          expect(path, `Missing HTTP path on ${controller.name}.${name}`).toBeDefined();
          return `${method}:${prefix}/${path}`;
        });
    });

    expect(routes).toHaveLength(15);
    expect(new Set(routes).size).toBe(routes.length);
  });
});
