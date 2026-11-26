import { createHash, randomUUID } from 'node:crypto';

import { AuthenticationStorage, MfaService, PasswordHasher, Public } from '@nestjs/authentication';
import type { INestApplication } from '@nestjs/common';
import {
  StandardSchemaValidationPipe,
  Body,
  Controller,
  HttpCode,
  Module,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ModulesContainer } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { AdminAuthController } from '../../../src/api/admin/auth/controllers/admin-auth.controller.js';
import { AdminSessionsController } from '../../../src/api/admin/auth/controllers/admin-sessions.controller.js';
import { SessionsController } from '../../../src/api/shared/auth/controllers/sessions.controller.js';
import { SharedAuthApiModule } from '../../../src/api/shared/auth/shared-auth-api.module.js';
import { SignOutController } from '../../../src/api/public/auth/controllers/sign-out.controller.js';
import { AdminSessionPurposeGuard } from '../../../src/common/auth/admin-session-purpose.guard.js';
import { AdminAuthApiModule } from '../../../src/api/admin/auth/admin-auth-api.module.js';
import { AuthController } from '../../../src/api/public/auth/controllers/auth.controller.js';
import { PublicAuthApiModule } from '../../../src/api/public/auth/public-auth-api.module.js';
import { AdminOriginGuard } from '../../../src/common/auth/admin-origin.guard.js';
import { AdminUsersApiModule } from '../../../src/api/admin/users/admin-users-api.module.js';
import { AdminUsersController } from '../../../src/api/admin/users/controllers/admin-users.controller.js';
import { UsersModule } from '../../../src/modules/users/users.module.js';
import { AdminUsersReadService } from '../../../src/modules/users/public-api.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { AdminMfaChallengeService } from '../../../src/modules/auth/services/admin-mfa-challenge.service.js';
import { AdminMfaEnrollmentService } from '../../../src/modules/auth/services/admin-mfa-enrollment.service.js';
import { AdminCookieAuthService } from '../../../src/modules/auth/services/admin-cookie-auth.service.js';
import {
  PrismaMfaStore,
  PrismaSessionStore,
  PrismaTokenStore,
} from '../../../src/modules/auth/stores/index.js';
import { AuthModule } from '../../../src/modules/auth/auth.module.js';
import {
  AdminSessionFacade,
  AdminSignInService,
  CredentialsService,
  AuthHttpQuotaFacade,
  AccountRecoveryRateLimitGuard,
  VerificationResendRateLimitGuard,
} from '../../../src/modules/auth/public-api.js';
import { TokenCleanupService } from '../../../src/modules/auth/services/token-cleanup.service.js';
import { createMfaEncryptionOptions } from '../../../src/common/config/mfa-keyring.config.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';
import { codeAt } from '../../utility/totp-code.js';

// Test-only consumer: prove route-scoped guards resolve the exported facade
// from AuthModule without re-registering Auth stores or throttle internals.
@Controller('auth/boundary-probe')
class AuthBoundaryProbeController {
  constructor(
    readonly credentials: CredentialsService,
    readonly adminSignIn: AdminSignInService,
    readonly sessions: AdminSessionFacade,
  ) {}

  @Public()
  @UseGuards(AccountRecoveryRateLimitGuard)
  @Post('recovery')
  @HttpCode(204)
  recovery(@Body() _body: { email: string }) {}

  @Public()
  @UseGuards(VerificationResendRateLimitGuard)
  @Post('resend')
  @HttpCode(204)
  resend() {}
}

@Module({ imports: [AuthModule], controllers: [AuthBoundaryProbeController] })
class AuthBoundaryProbeModule {}

describe('GET /admin/users (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const operatorId = randomUUID();
  const priorAllowlist = process.env.SUPERADMIN_USER_IDS;
  const suffix = randomUUID();
  const password = 'StrongPassword123!';
  const ids: string[] = [];
  const cookies: Record<string, string> = {};

  async function seedAccount(
    key: string,
    role: 'ATHLETE' | 'TRAINER' | 'ADMIN',
    deletedAt?: Date,
    id = randomUUID(),
  ) {
    const email = `admin-list-${key}-${suffix}@example.test`;
    const hash = await app.get(PasswordHasher).hash(password);
    const account = await prisma.user.create({
      data: {
        id,
        email,
        role,
        passwordHash: hash,
        emailVerified: true,
        ...(deletedAt ? { deletedAt } : {}),
      },
      select: { id: true, email: true },
    });
    ids.push(account.id);
    if (!deletedAt) {
      const signIn = await request(app.getHttpServer())
        .post(role === 'ADMIN' ? '/auth/admin-login' : '/auth/login')
        .send({ email, password });
      expect(signIn.status).toBe(200);
      const raw = signIn.headers['set-cookie'];
      const setCookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const cookie = setCookies
        .map((value) => value.split(';', 1)[0] ?? '')
        .find((value) => value.startsWith(role === 'ADMIN' ? '__Host-admin-sid=' : '__Host-sid='));
      if (!cookie) throw new Error('Expected session cookie');
      cookies[key] = cookie;
    }
    return account;
  }

  beforeAll(async () => {
    useTestDatabase();
    process.env.SUPERADMIN_USER_IDS = operatorId;

    const moduleRef = await Test.createTestingModule({
      imports: [await ConfigModule.forRoot({ isGlobal: true }), AppModule, AuthBoundaryProbeModule],
    })
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
    prisma = app.get(PrismaService);

    await seedAccount('operator', 'ADMIN', undefined, operatorId);
    await seedAccount('plain-admin', 'ADMIN');
    await seedAccount('athlete', 'ATHLETE');
    await seedAccount('trainer', 'TRAINER');
    const suspended = await seedAccount('suspended', 'ATHLETE');
    await prisma.user.update({ where: { id: suspended.id }, data: { status: 'SUSPENDED' } });
    await seedAccount('deleted', 'ATHLETE', new Date());
  }, 30_000);

  afterAll(async () => {
    try {
      if (prisma && ids.length) {
        await prisma.outboxEvent.deleteMany({ where: { actorUserId: { in: ids } } });
        await prisma.mfaLifecycleAudit.deleteMany({ where: { userId: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
      }
    } finally {
      await app?.close();
      if (priorAllowlist === undefined) delete process.env.SUPERADMIN_USER_IDS;
      else process.env.SUPERADMIN_USER_IDS = priorAllowlist;
    }
  }, 20_000);

  it('registers the directory controller once in the Admin API module with a shared Users provider', () => {
    const modules = app.get(ModulesContainer);
    const owners = [...modules.values()].filter((module) =>
      module.controllers.has(AdminUsersController),
    );
    expect(owners.map((module) => module.metatype)).toEqual([AdminUsersApiModule]);
    const featureProvider = app.select(UsersModule).get(AdminUsersReadService, { strict: true });
    expect(featureProvider).toBeInstanceOf(AdminUsersReadService);
    expect(
      app.select(AdminUsersApiModule).get(AdminUsersController, { strict: true }),
    ).toBeInstanceOf(AdminUsersController);
    expect([...modules.values()].filter((module) => module.metatype === UsersModule)).toHaveLength(
      1,
    );
  });

  it('owns ordinary and Admin login in distinct audience modules with one Admin sign-in provider', () => {
    const modules = [...app.get(ModulesContainer).values()];
    expect(
      modules
        .filter((module) => module.controllers.has(AuthController))
        .map((module) => module.metatype),
    ).toEqual([PublicAuthApiModule]);
    expect(
      modules
        .filter((module) => module.controllers.has(AdminAuthController))
        .map((module) => module.metatype),
    ).toEqual([AdminAuthApiModule]);
    expect(
      modules
        .filter((module) => module.providers.has(AdminSignInService))
        .map((module) => module.metatype),
    ).toEqual([AuthModule]);
    expect(
      app.select(AdminAuthApiModule).get(AdminAuthController, { strict: true }),
    ).toBeInstanceOf(AdminAuthController);
    expect(app.select(PublicAuthApiModule).get(AuthController, { strict: true })).toBeInstanceOf(
      AuthController,
    );
    expect(
      modules
        .find((module) => module.metatype === AdminAuthApiModule)
        ?.injectables.has(AdminOriginGuard),
    ).toBe(true);
  });

  it('owns Admin sessions in the Admin API and ordinary sessions in Shared API without duplicating guards in core', async () => {
    const modules = [...app.get(ModulesContainer).values()];
    expect(
      modules
        .filter((module) => module.controllers.has(AdminSessionsController))
        .map((module) => module.metatype),
    ).toEqual([AdminAuthApiModule]);
    expect(
      modules
        .filter((module) => module.controllers.has(SessionsController))
        .map((module) => module.metatype),
    ).toEqual([SharedAuthApiModule]);
    expect(
      app.select(AdminAuthApiModule).get(AdminSessionsController, { strict: true }),
    ).toBeInstanceOf(AdminSessionsController);
    expect(
      modules
        .filter((module) => module.controllers.has(SignOutController))
        .map((module) => module.metatype),
    ).toEqual([PublicAuthApiModule]);
    expect(app.select(PublicAuthApiModule).get(SignOutController, { strict: true })).toBeInstanceOf(
      SignOutController,
    );
    expect(
      app.select(SharedAuthApiModule).get(SessionsController, { strict: true }),
    ).toBeInstanceOf(SessionsController);
    const core = modules.find((module) => module.metatype === AuthModule);
    expect(core?.controllers.size).toBe(0);
    const admin = modules.find((module) => module.metatype === AdminAuthApiModule);
    for (const guard of [AdminOriginGuard, AdminSessionPurposeGuard]) {
      expect(core?.providers.has(guard)).toBe(false);
      expect(core?.injectables.has(guard)).toBe(false);
      expect(admin?.injectables.has(guard)).toBe(true);
    }
    for (const [method, path] of [
      ['get', '/auth/admin-session'],
      ['post', '/auth/admin-sessions/revoke-all'],
      ['post', '/auth/admin-sign-out'],
      ['get', '/auth/sessions'],
      ['delete', '/auth/sessions/not-owned'],
      ['post', '/auth/sign-out-everywhere'],
      ['post', '/auth/sign-out'],
    ] as const) {
      const denied = await request(app.getHttpServer())[method](path).expect(401);
      expect(denied.headers['cache-control']).toBe('no-store');
    }
  });

  it('owns the Admin session facade and private Auth lifecycle providers exactly once', () => {
    const modules = [...app.get(ModulesContainer).values()];
    expect(modules.filter((module) => module.metatype === AuthModule)).toHaveLength(1);
    for (const provider of [
      AdminSessionFacade,
      PrismaSessionStore,
      PrismaTokenStore,
      PrismaMfaStore,
      AdminCookieAuthService,
      TokenCleanupService,
    ]) {
      expect(
        modules.filter((module) => module.providers.has(provider)).map((module) => module.metatype),
      ).toEqual([AuthModule]);
    }
    expect(app.select(AuthModule).get(AdminSessionFacade, { strict: true })).toBeInstanceOf(
      AdminSessionFacade,
    );
  });

  it('resolves exported credential and Admin commands and route guards in a separate consumer module', async () => {
    const probe = app
      .select(AuthBoundaryProbeModule)
      .get(AuthBoundaryProbeController, { strict: true });
    const auth = app.select(AuthModule);
    expect(probe.credentials).toBe(auth.get(CredentialsService, { strict: true }));
    expect(probe.adminSignIn).toBe(auth.get(AdminSignInService, { strict: true }));
    expect(probe.sessions).toBe(auth.get(AdminSessionFacade, { strict: true }));
    const modules = [...app.get(ModulesContainer).values()];
    for (const provider of [CredentialsService, AdminSignInService, AuthHttpQuotaFacade]) {
      expect(
        modules.filter((module) => module.providers.has(provider)).map((module) => module.metatype),
      ).toEqual([AuthModule]);
    }
    const email = `boundary-probe-${randomUUID()}@example.test`;
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/boundary-probe/recovery')
        .send({ email })
        .expect(204);
    }
    await request(app.getHttpServer())
      .post('/auth/boundary-probe/recovery')
      .send({ email })
      .expect(429);
    await request(app.getHttpServer()).post('/auth/boundary-probe/resend').expect(401);
  });

  const list = (cookie: string, query: Record<string, string> = {}) =>
    request(app.getHttpServer()).get('/admin/users').query(query).set('Cookie', cookie);

  async function loginOperator(path: '/auth/login' | '/auth/admin-login') {
    const operator = await prisma.user.findUniqueOrThrow({
      where: { id: operatorId },
      select: { email: true },
    });
    const signed = await request(app.getHttpServer()).post(path).send({
      email: operator.email,
      password,
    });
    expect(signed.status).toBe(200);
    const raw = signed.headers['set-cookie'];
    const headers = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const cookieHeader = headers.find((value) =>
      value.startsWith(path === '/auth/admin-login' ? '__Host-admin-sid=' : '__Host-sid='),
    );
    expect(cookieHeader).toBeTruthy();
    const cookie = cookieHeader!.split(';', 1)[0]!;
    const id = createHash('sha256').update(cookie.split('=', 2)[1]!).digest('base64url');
    const row = await prisma.session.findUniqueOrThrow({ where: { id } });
    return { cookie, cookieHeader: cookieHeader!, id, row };
  }

  it('enforces Admin-only request origin on login, session inspection and admin directory', async () => {
    const config = app.get(ConfigService);
    const expected = new URL(
      config.get<string>('ADMIN_APP_URL') ?? config.getOrThrow<string>('APP_URL'),
    ).origin;
    const untrusted = 'https://untrusted-admin-origin.invalid';
    const operator = await prisma.user.findUniqueOrThrow({
      where: { id: operatorId },
      select: { email: true },
    });

    const login = (origin: string) =>
      request(app.getHttpServer())
        .post('/auth/admin-login')
        .set('Origin', origin)
        .send({ email: operator.email, password });

    expect((await login(untrusted)).status).toBe(403);
    expect((await login(expected)).status).toBe(200);
    // Ordinary user login is intentionally outside the Admin-origin policy.
    expect(
      (
        await request(app.getHttpServer())
          .post('/auth/login')
          .set('Origin', expected)
          .send({ email: operator.email, password })
      ).status,
    ).toBe(200);

    const check = () =>
      request(app.getHttpServer()).get('/auth/admin-session').set('Cookie', cookies.operator!);
    expect((await check()).status).toBe(200); // Next SSR is originless.
    expect((await check().set('Origin', expected)).status).toBe(200);
    expect((await check().set('Origin', untrusted)).status).toBe(403);
    expect((await check().set('Origin', 'null')).status).toBe(403);
    expect((await check().set('Sec-Fetch-Site', 'cross-site')).status).toBe(403);
    expect((await check().set('Referer', untrusted + '/x')).status).toBe(403);
    expect((await check().set('Referer', expected + '/users')).status).toBe(200);

    expect(
      (
        await request(app.getHttpServer())
          .get('/admin/users')
          .set('Cookie', cookies.operator!)
          .set('Origin', untrusted)
      ).status,
    ).toBe(403);
    const existing = await prisma.session.count({
      where: { userId: operatorId, metadata: { path: ['purpose'], equals: 'admin' } },
    });
    const deniedRevocation = await request(app.getHttpServer())
      .post('/auth/admin-sessions/revoke-all')
      .set('Cookie', cookies.operator!)
      .set('Origin', untrusted);
    expect([401, 403]).toContain(deniedRevocation.status);
    expect(
      await prisma.session.count({
        where: { userId: operatorId, metadata: { path: ['purpose'], equals: 'admin' } },
      }),
    ).toBe(existing);
  });

  it('persists an 8h absolute Admin expiry and issues the same bounded cookie lifetime', async () => {
    const { cookie, cookieHeader, row } = await loginOperator('/auth/admin-login');
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(8 * 60 * 60 * 1000);
    const age = Number(cookieHeader.match(/Max-Age=(\d+)/)?.[1]);
    expect(age).toBeGreaterThanOrEqual(8 * 60 * 60 - 2);
    expect(age).toBeLessThanOrEqual(8 * 60 * 60);
    const alive = await request(app.getHttpServer())
      .get('/auth/admin-session')
      .set('Cookie', cookie);
    expect(alive.status).toBe(200);
  });

  it('denies an Admin cookie idle for 15 minutes before activity can refresh it', async () => {
    const { id, cookie } = await loginOperator('/auth/admin-login');
    const expiredActivity = new Date(Date.now() - 16 * 60 * 1000);
    await prisma.session.update({ where: { id }, data: { lastActiveAt: expiredActivity } });
    const denied = await request(app.getHttpServer())
      .get('/auth/admin-session')
      .set('Cookie', cookie);
    expect(denied.status).toBe(401);
    const guarded = await list(cookie);
    expect(guarded.status).toBe(401);
    const unchanged = await prisma.session.findUniqueOrThrow({ where: { id } });
    expect(unchanged.lastActiveAt).toEqual(expiredActivity);
  });

  it('rejects a legacy Admin-purpose row beyond 8h even when its persisted expiresAt is later', async () => {
    const { cookie, id } = await loginOperator('/auth/admin-login');
    await prisma.session.update({
      where: { id },
      data: {
        createdAt: new Date(Date.now() - 9 * 60 * 60 * 1000),
        lastActiveAt: new Date(),
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
    });
    const denied = await request(app.getHttpServer())
      .get('/auth/admin-session')
      .set('Cookie', cookie);
    expect(denied.status).toBe(401);
  });

  it('preserves ordinary 7d/1d cookies and ordinary profile access after 16m idle', async () => {
    const { cookie, id, row } = await loginOperator('/auth/login');
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    await prisma.session.update({
      where: { id },
      data: { lastActiveAt: new Date(Date.now() - 16 * 60 * 1000) },
    });
    const profile = await request(app.getHttpServer()).get('/users/me').set('Cookie', cookie);
    expect(profile.status).toBe(200);
    expect(profile.body.id).toBe(operatorId);
    expect((await list(cookie)).status).toBe(401);
  });

  it('rejects anonymous 401 and all non-operator roles 403 without leaking records', async () => {
    const anonymous = await request(app.getHttpServer()).get('/admin/users');
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers['cache-control']).toContain('no-store');
    for (const key of ['plain-admin', 'athlete', 'trainer']) {
      const response = await list(cookies[key]!);
      expect(response.status).toBe(key === 'plain-admin' ? 403 : 401);
      expect(JSON.stringify(response.body)).not.toContain(`admin-list-athlete-${suffix}`);
      expect(response.headers['cache-control']).toContain('no-store');
    }
  });

  it('refuses ordinary login cookies for privileged Admin routes and supports explicit admin-purpose login', async () => {
    const operator = await prisma.user.findUniqueOrThrow({
      where: { id: operatorId },
      select: { email: true },
    });
    const ordinary = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: operator.email, password });
    expect(ordinary.status).toBe(200);
    const normalCookies = ordinary.headers['set-cookie'];
    const normal = (
      Array.isArray(normalCookies) ? normalCookies : normalCookies ? [normalCookies] : []
    )
      .map((value) => value.split(';', 1)[0] ?? '')
      .find((value) => value.startsWith('__Host-sid='));
    expect(normal).toBeTruthy();

    const oldSession = await request(app.getHttpServer())
      .get('/auth/admin-session')
      .set('Cookie', normal!);
    expect(oldSession.status).toBe(401);
    expect(oldSession.headers['cache-control']).toContain('no-store');
    expect((await list(normal!)).status).toBe(401);

    const liveSession = await request(app.getHttpServer())
      .get('/auth/admin-session')
      .set('Cookie', cookies.operator!);
    expect(liveSession.status).toBe(200);
    expect(liveSession.body).toEqual({ id: operatorId, role: 'ADMIN' });
    expect(liveSession.headers['cache-control']).toContain('no-store');

    const active = await prisma.session.findMany({
      where: { userId: operatorId },
      select: { metadata: true },
    });
    expect(
      active.some((row) => {
        const metadata = row.metadata;
        return (
          typeof metadata === 'object' &&
          metadata !== null &&
          !Array.isArray(metadata) &&
          metadata['purpose'] === 'admin'
        );
      }),
    ).toBe(true);
  });

  it('denies non-admin credentials and does not issue an elevated cookie', async () => {
    const athlete = await prisma.user.findFirstOrThrow({
      where: { email: { contains: 'admin-list-athlete-' + suffix } },
      select: { email: true },
    });
    for (const pair of [
      { email: athlete.email, password },
      { email: 'unknown@example.test', password },
      { email: athlete.email, password: 'invalid-password' },
    ]) {
      const result = await request(app.getHttpServer()).post('/auth/admin-login').send(pair);
      expect(result.status).toBe(401);
      expect(result.headers['cache-control']).toContain('no-store');
      expect(JSON.stringify(result.body)).not.toContain(pair.email);
      expect(result.headers['set-cookie']).toBeUndefined();
    }
  });

  it('refuses admin-purpose verification with only an operator bearer JWT', async () => {
    const operator = await prisma.user.findUniqueOrThrow({
      where: { id: operatorId },
      select: { email: true },
    });
    const issued = await request(app.getHttpServer())
      .post('/auth/token')
      .send({ email: operator.email, password });
    expect(issued.status).toBe(200);
    const result = await request(app.getHttpServer())
      .get('/auth/admin-session')
      .set('Authorization', 'Bearer ' + issued.body.accessToken);
    expect(result.status).toBe(401);
  });

  it('rejects valid operator bearer JWT on privileged reads but preserves ordinary API token access', async () => {
    const operator = await prisma.user.findUniqueOrThrow({
      where: { id: operatorId },
      select: { email: true },
    });
    const issued = await request(app.getHttpServer())
      .post('/auth/token')
      .send({ email: operator.email, password });
    expect(issued.status).toBe(200);
    const token = issued.body.accessToken as string;
    expect(token).toBeTruthy();

    const normal = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', 'Bearer ' + token);
    expect(normal.status).toBe(200);
    expect(normal.body.id).toBe(operatorId);

    for (const path of ['/admin/users', '/admin/users/' + operatorId]) {
      const denied = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', 'Bearer ' + token);
      expect(denied.status).toBe(401);
      expect(denied.headers['cache-control']).toContain('no-store');
      expect(JSON.stringify(denied.body)).not.toContain(operator.email);
    }
  });

  it('binds privileged authorization to the cookie identity, not a conflicting bearer token', async () => {
    const operator = await prisma.user.findUniqueOrThrow({
      where: { id: operatorId },
      select: { email: true },
    });
    const athlete = await prisma.user.findFirstOrThrow({
      where: { email: { contains: 'admin-list-athlete-' + suffix } },
      select: { email: true },
    });
    async function issue(email: string) {
      const result = await request(app.getHttpServer())
        .post('/auth/token')
        .send({ email, password });
      expect(result.status).toBe(200);
      return result.body.accessToken as string;
    }
    const operatorJwt = await issue(operator.email);
    const athleteJwt = await issue(athlete.email);

    const cannotEscalate = await request(app.getHttpServer())
      .get('/admin/users')
      .set('Cookie', cookies.athlete!)
      .set('Authorization', 'Bearer ' + operatorJwt);
    expect(cannotEscalate.status).toBe(401);

    const cookieWins = await request(app.getHttpServer())
      .get('/admin/users')
      .set('Cookie', cookies.operator!)
      .set('Authorization', 'Bearer ' + athleteJwt);
    expect(cookieWins.status).toBe(200);
  });

  it('rejects a signed-out session even alongside an otherwise valid operator bearer token', async () => {
    const operator = await prisma.user.findUniqueOrThrow({
      where: { id: operatorId },
      select: { email: true },
    });
    const loggedIn = await request(app.getHttpServer())
      .post('/auth/admin-login')
      .send({ email: operator.email, password });
    expect(loggedIn.status).toBe(200);
    const raw = loggedIn.headers['set-cookie'];
    const headers = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const cookie = headers
      .map((value) => value.split(';', 1)[0] ?? '')
      .find((value) => value.startsWith('__Host-admin-sid='));
    expect(cookie).toBeTruthy();

    const issued = await request(app.getHttpServer())
      .post('/auth/token')
      .send({ email: operator.email, password });
    expect(issued.status).toBe(200);
    const signedOut = await request(app.getHttpServer())
      .post('/auth/admin-sign-out')
      .set('Cookie', cookie!);
    expect(signedOut.status).toBe(204);

    const denied = await request(app.getHttpServer())
      .get('/admin/users')
      .set('Cookie', cookie!)
      .set('Authorization', 'Bearer ' + issued.body.accessToken);
    expect(denied.status).toBe(401);
    expect(denied.headers['cache-control']).toContain('no-store');
  });

  it('returns a bounded, minimal privileged list with stable pagination and filters', async () => {
    const url = { search: `admin-list-`, limit: '2', page: '1' };
    const first = await list(cookies.operator!, url);
    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toContain('no-store');
    expect(first.body.meta).toMatchObject({
      total: 5,
      skip: 0,
      take: 2,
      totalPages: 3,
    });
    expect(first.body.data).toHaveLength(2);
    for (const record of first.body.data as Record<string, unknown>[]) {
      expect(Object.keys(record).sort()).toEqual(['createdAt', 'email', 'id', 'role', 'status']);
      expect(['ACTIVE', 'SUSPENDED']).toContain(record.status);
      expect(JSON.stringify(record)).not.toContain('passwordHash');
      expect(JSON.stringify(record)).not.toContain('deletedAt');
      expect(JSON.stringify(record)).not.toContain('preferredLocale');
      expect(JSON.stringify(record)).not.toContain('profile');
    }

    const second = await list(cookies.operator!, { ...url, page: '2' });
    expect(second.status).toBe(200);
    expect(second.body.data).toHaveLength(2);
    const ids1 = first.body.data.map((v: { id: string }) => v.id);
    const ids2 = second.body.data.map((v: { id: string }) => v.id);
    expect(new Set([...ids1, ...ids2]).size).toBe(4);

    const trainer = await list(cookies.operator!, {
      search: `admin-list-`,
      role: 'TRAINER',
      status: 'ACTIVE',
    });
    expect(trainer.status).toBe(200);
    expect(trainer.body.data).toHaveLength(1);
    expect(trainer.body.data[0].role).toBe('TRAINER');

    const future = await list(cookies.operator!, {
      createdFrom: '2099-01-01T00:00:00Z',
      search: `admin-list-`,
    });
    expect(future.status).toBe(200);
    expect(future.body.data).toHaveLength(0);
    expect(future.body.meta.total).toBe(0);
  });

  it('reads persisted suspended status via privileged list/detail without exposing credentials', async () => {
    const listResponse = await list(cookies.operator!, {
      search: 'admin-list-',
      status: 'SUSPENDED',
    });
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    const record = listResponse.body.data[0];
    expect(record.status).toBe('SUSPENDED');
    expect(record.email).toContain('admin-list-suspended-');
    expect(Object.keys(record).sort()).toEqual(['createdAt', 'email', 'id', 'role', 'status']);

    const detail = await request(app.getHttpServer())
      .get(`/admin/users/${record.id}`)
      .set('Cookie', cookies.operator!);
    expect(detail.status).toBe(200);
    expect(detail.body.status).toBe('SUSPENDED');
    expect(JSON.stringify(detail.body)).not.toContain('passwordHash');
    expect(JSON.stringify(detail.body)).not.toContain('deletedAt');
    expect(detail.headers['cache-control']).toContain('no-store');
  });

  it('rejects unknown parameters and invalid dates', async () => {
    const invalidQueries: Record<string, string>[] = [
      { limit: '51' },
      { status: 'UNKNOWN' },
      { page: '0' },
      { deletedAt: 'not-null' },
      { createdFrom: '2100-01-01T00:00:00Z', createdTo: '2020-01-01T00:00:00Z' },
    ];
    for (const query of invalidQueries) {
      const response = await list(cookies.operator!, query);
      expect(response.status).toBe(400);
    }
  });

  it('keeps a privileged account detail read minimal and rejects missing or deleted accounts', async () => {
    const target = await prisma.user.findFirstOrThrow({
      where: { email: { contains: `admin-list-trainer-${suffix}` } },
      select: { id: true },
    });
    const response = await request(app.getHttpServer())
      .get(`/admin/users/${target.id}`)
      .set('Cookie', cookies.operator!);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(Object.keys(response.body).sort()).toEqual([
      'createdAt',
      'email',
      'emailVerified',
      'id',
      'role',
      'status',
      'updatedAt',
    ]);
    expect(response.body).toMatchObject({
      id: target.id,
      role: 'TRAINER',
      status: 'ACTIVE',
      emailVerified: true,
    });
    for (const key of ['passwordHash', 'profile', 'preferredLocale', 'deletedAt', 'sessions']) {
      expect(response.body).not.toHaveProperty(key);
    }

    const absent = await request(app.getHttpServer())
      .get(`/admin/users/${randomUUID()}`)
      .set('Cookie', cookies.operator!);
    expect(absent.status).toBe(404);
    expect(absent.headers['cache-control']).toContain('no-store');

    const deleted = await prisma.user.findFirstOrThrow({
      where: { email: { contains: `admin-list-deleted-${suffix}` } },
      select: { id: true },
    });
    const deletedResponse = await request(app.getHttpServer())
      .get(`/admin/users/${deleted.id}`)
      .set('Cookie', cookies.operator!);
    expect(deletedResponse.status).toBe(404);

    const malformed = await request(app.getHttpServer())
      .get('/admin/users/not-a-uuid')
      .set('Cookie', cookies.operator!);
    expect(malformed.status).toBe(400);
  });

  it('rejects anonymous and non-operator detail requests before disclosing existence', async () => {
    const target = await prisma.user.findFirstOrThrow({
      where: { email: { contains: `admin-list-athlete-${suffix}` } },
      select: { id: true },
    });

    const anonymous = await request(app.getHttpServer()).get(`/admin/users/${target.id}`);
    expect(anonymous.status).toBe(401);
    for (const key of ['plain-admin', 'athlete', 'trainer']) {
      for (const id of [target.id, randomUUID()]) {
        const denied = await request(app.getHttpServer())
          .get(`/admin/users/${id}`)
          .set('Cookie', cookies[key]!);
        expect(denied.status).toBe(key === 'plain-admin' ? 403 : 401);
        expect(JSON.stringify(denied.body)).not.toContain(`admin-list-athlete-${suffix}`);
        expect(denied.headers['cache-control']).toContain('no-store');
      }
    }
  });

  it('revokes privileged read on the very next request if the persisted ADMIN role changes', async () => {
    await prisma.user.update({ where: { id: operatorId }, data: { role: 'ATHLETE' } });
    try {
      const response = await list(cookies.operator!);
      expect(response.status).toBe(403);
      expect(JSON.stringify(response.body)).not.toContain(`admin-list-athlete-${suffix}`);
    } finally {
      await prisma.user.update({ where: { id: operatorId }, data: { role: 'ADMIN' } });
    }
  });

  it('requires a live admin-purpose cookie to revoke admin sessions, never JWT or regular login', async () => {
    const regular = await loginOperator('/auth/login');
    const operator = await prisma.user.findUniqueOrThrow({
      where: { id: operatorId },
      select: { email: true },
    });
    const issued = await request(app.getHttpServer())
      .post('/auth/token')
      .send({ email: operator.email, password });
    expect(issued.status).toBe(200);

    const revoke = () => request(app.getHttpServer()).post('/auth/admin-sessions/revoke-all');
    expect((await revoke()).status).toBe(401);
    expect((await revoke().set('Authorization', 'Bearer ' + issued.body.accessToken)).status).toBe(
      401,
    );
    expect((await revoke().set('Cookie', regular.cookie)).status).toBe(401);
    expect((await revoke().set('Cookie', cookies.athlete!)).status).toBe(401);

    const crossOrigin = await revoke()
      .set('Cookie', cookies.operator!)
      .set('Origin', 'https://attacker.invalid');
    expect([401, 403]).toContain(crossOrigin.status);
    expect(
      (
        await request(app.getHttpServer())
          .get('/auth/admin-session')
          .set('Cookie', cookies.operator!)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .get('/users/me')
          .set('Authorization', 'Bearer ' + issued.body.accessToken)
      ).status,
    ).toBe(200);
  });

  it('keeps independent Admin and ordinary cookie sessions alive in one browser and signs out only Admin', async () => {
    const ordinary = await loginOperator('/auth/login');
    const operator = await prisma.user.findUniqueOrThrow({
      where: { id: operatorId },
      select: { email: true },
    });
    const elevated = await request(app.getHttpServer())
      .post('/auth/admin-login')
      .set('Cookie', ordinary.cookie)
      .send({ email: operator.email, password });
    expect(elevated.status).toBe(200);
    const raw = elevated.headers['set-cookie'];
    const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const elevatedCookie = items
      .map((c) => c.split(';', 1)[0] ?? '')
      .find((c) => c.startsWith('__Host-admin-sid='))!;
    expect(elevatedCookie).toBeTruthy();
    expect(items.some((item) => item.startsWith('__Host-sid='))).toBe(false);

    // The privileged cookie must not authenticate an ordinary API route.
    expect(
      (await request(app.getHttpServer()).get('/users/me').set('Cookie', elevatedCookie)).status,
    ).toBe(401);
    expect(
      (await request(app.getHttpServer()).get('/auth/admin-session').set('Cookie', ordinary.cookie))
        .status,
    ).toBe(401);
    // Both cookies may be sent together: each route chooses its own realm.
    const combined = ordinary.cookie + '; ' + elevatedCookie;
    expect(
      (await request(app.getHttpServer()).get('/users/me').set('Cookie', combined)).status,
    ).toBe(200);
    expect(
      (await request(app.getHttpServer()).get('/auth/admin-session').set('Cookie', combined))
        .status,
    ).toBe(200);
    expect((await list(combined)).status).toBe(200);

    const adminLogout = await request(app.getHttpServer())
      .post('/auth/admin-sign-out')
      .set('Cookie', combined);
    expect(adminLogout.status).toBe(204);
    const clears = adminLogout.headers['set-cookie'];
    const cleared = Array.isArray(clears) ? clears : clears ? [clears] : [];
    expect(
      cleared.some((item) => item.startsWith('__Host-admin-sid=;') && item.includes('Max-Age=0')),
    ).toBe(true);
    expect(cleared.some((item) => item.startsWith('__Host-sid='))).toBe(false);
    expect(
      (await request(app.getHttpServer()).get('/auth/admin-session').set('Cookie', elevatedCookie))
        .status,
    ).toBe(401);
    expect(
      (await request(app.getHttpServer()).get('/users/me').set('Cookie', ordinary.cookie)).status,
    ).toBe(200);
  });

  it('denies pending-MFA Admin cookies and lets a pending challenge sign out without touching normal auth', async () => {
    const admin = await loginOperator('/auth/admin-login');
    const regular = await loginOperator('/auth/login');
    await prisma.session.update({ where: { id: admin.id }, data: { mfa: 'pending' } });
    expect(
      (await request(app.getHttpServer()).get('/auth/admin-session').set('Cookie', admin.cookie))
        .status,
    ).toBe(401);
    const end = await request(app.getHttpServer())
      .post('/auth/admin-sign-out')
      .set('Cookie', admin.cookie);
    expect(end.status).toBe(204);
    expect(await prisma.session.findUnique({ where: { id: admin.id } })).toBeNull();
    expect(
      (await request(app.getHttpServer()).get('/users/me').set('Cookie', regular.cookie)).status,
    ).toBe(200);
  });

  it('fails closed on an unrecognized stored Admin MFA state without affecting regular auth', async () => {
    const admin = await loginOperator('/auth/admin-login');
    const regular = await loginOperator('/auth/login');
    await prisma.session.update({ where: { id: admin.id }, data: { mfa: 'unexpected' } });
    expect(
      (await request(app.getHttpServer()).get('/auth/admin-session').set('Cookie', admin.cookie))
        .status,
    ).toBe(401);
    expect((await list(admin.cookie)).status).toBe(401);
    expect(
      (await request(app.getHttpServer()).get('/users/me').set('Cookie', regular.cookie)).status,
    ).toBe(200);
  });

  it('revokes only caller admin sessions across devices, clears cookie and preserves all ordinary sessions', async () => {
    const actor = await seedAccount('revoke-actor', 'ADMIN');
    const first = cookies['revoke-actor']!;
    const auth = (path: '/auth/login' | '/auth/admin-login') =>
      request(app.getHttpServer()).post(path).send({ email: actor.email, password });
    const secondResponse = await auth('/auth/admin-login');
    const thirdResponse = await auth('/auth/admin-login');
    const regularResponse = await auth('/auth/login');

    const extractCookie = (
      result: typeof secondResponse,
      name: '__Host-admin-sid' | '__Host-sid',
    ) => {
      const raw = result.headers['set-cookie'];
      const all = Array.isArray(raw) ? raw : raw ? [raw] : [];
      return all
        .map((item) => item.split(';', 1)[0] ?? '')
        .find((item) => item.startsWith(name + '='))!;
    };
    expect(secondResponse.status).toBe(200);
    expect(thirdResponse.status).toBe(200);
    expect(regularResponse.status).toBe(200);

    const second = extractCookie(secondResponse, '__Host-admin-sid');
    const third = extractCookie(thirdResponse, '__Host-admin-sid');
    const regular = extractCookie(regularResponse, '__Host-sid');
    const adminCount = await prisma.session.count({
      where: { userId: actor.id, metadata: { path: ['purpose'], equals: 'admin' } },
    });
    expect(adminCount).toBe(3);
    const revoked = await request(app.getHttpServer())
      .post('/auth/admin-sessions/revoke-all')
      .set('Cookie', second);
    expect(revoked.status).toBe(204);
    expect(revoked.headers['cache-control']).toContain('no-store');
    const setCookie = revoked.headers['set-cookie'];
    const cleared = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    expect(
      cleared.some((item) => item.startsWith('__Host-admin-sid=;') && item.includes('Max-Age=0')),
    ).toBe(true);

    for (const cookie of [first, second, third]) {
      expect(
        (await request(app.getHttpServer()).get('/auth/admin-session').set('Cookie', cookie))
          .status,
      ).toBe(401);
      expect(
        (
          await request(app.getHttpServer())
            .post('/auth/admin-sessions/revoke-all')
            .set('Cookie', cookie)
        ).status,
      ).toBe(401);
    }
    expect(
      await prisma.session.count({
        where: { userId: actor.id, metadata: { path: ['purpose'], equals: 'admin' } },
      }),
    ).toBe(0);
    expect(
      (await request(app.getHttpServer()).get('/users/me').set('Cookie', regular)).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .get('/auth/admin-session')
          .set('Cookie', cookies.operator!)
      ).status,
    ).toBe(200);
    expect(
      (await request(app.getHttpServer()).get('/users/me').set('Cookie', cookies.athlete!)).status,
    ).toBe(200);
  });

  it('denies recovery grants on Admin routes and revokes them on logout', async () => {
    const owner = await seedAccount('mfa-boundary', 'ADMIN');
    const legacy = cookies['mfa-boundary']!;
    const legacyId = createHash('sha256').update(legacy.split('=', 2)[1]!).digest('base64url');
    const config = app.get(ConfigService);
    const previous = config.get('MFA_ENCRYPTION_KEYS');
    const keyring = createHash('sha256').update('admin boundary test key').digest('base64url');
    config.set('MFA_ENCRYPTION_KEYS', keyring);
    try {
      // Use the library to create a real factor and recovery batch, without
      // exposing enrollment or challenge endpoints to the browser.
      const enrollment = app.get(AdminMfaEnrollmentService);
      const staged = await enrollment.begin({ userId: owner.id, sessionId: legacyId }, password);
      const store = app.get(MfaService);
      // Global MFA stays disabled; the challenge uses the isolated store.
      expect(await store.isEnrolled(owner.id)).toBe(false);
      const isolated = new AuthenticationStorage();
      isolated.registerSource({ mfa: app.get(PrismaMfaStore) });
      const encryption = createMfaEncryptionOptions(keyring, config.getOrThrow('JWT_SECRET'));
      const mfa = new MfaService(isolated, { mfa: { encryption } });
      const codes = await mfa.generateRecoveryCodes(owner.id);
      await prisma.mfaAuthenticator.update({
        where: { userId: owner.id },
        data: { confirmed: true },
      });
      await prisma.session.update({ where: { id: legacyId }, data: { mfa: 'verified' } });
      const probe = (cookie: string) =>
        request(app.getHttpServer()).get('/auth/admin-session').set('Cookie', cookie);
      expect((await probe(legacy)).status).toBe(401);

      const challenge = app.get(AdminMfaChallengeService);
      const normalPending = (await challenge.begin(owner.id, password))!;
      const normal = await challenge.complete(normalPending.token, { code: codeAt(staged.secret) });
      expect(normal?.session.metadata?.adminMfaMethod).toBe('totp');
      const normalCookie = normal!.cookie.split(';', 1)[0]!;
      expect((await probe(normalCookie)).status).toBe(200);
      const pending = (await challenge.begin(owner.id, password))!;
      const pendingCookie = pending.cookie.split(';', 1)[0]!;
      expect((await probe(pendingCookie)).status).toBe(401);
      const helper = app.get(AdminCookieAuthService);
      const verified = await helper.completeMfa(
        { headers: { cookie: pendingCookie }, method: 'POST' },
        { append: () => undefined } as never,
        { recoveryCode: codes[0]! },
      );
      expect(verified?.session.mfa).toBe('verified');
      const cookie = verified!.cookie.split(';', 1)[0]!;
      expect((await probe(cookie)).status).toBe(401);
      expect((await probe(normalCookie)).status).toBe(401);
      expect((await list(cookie)).status).toBe(401);
      expect(
        (
          await request(app.getHttpServer())
            .post('/auth/admin-sessions/revoke-all')
            .set('Cookie', cookie)
        ).status,
      ).toBe(401);
      expect((await probe(pendingCookie)).status).toBe(401);
      const ordinary = cookie.replace('__Host-admin-sid=', '__Host-sid=');
      const profile = await request(app.getHttpServer()).get('/users/me').set('Cookie', ordinary);
      expect(profile.status).toBe(401);
      const ended = await request(app.getHttpServer())
        .post('/auth/admin-sign-out')
        .set('Cookie', cookie);
      expect(ended.status).toBe(204);
      expect((await probe(cookie)).status).toBe(401);
    } finally {
      config.set('MFA_ENCRYPTION_KEYS', previous);
    }
  });
});
