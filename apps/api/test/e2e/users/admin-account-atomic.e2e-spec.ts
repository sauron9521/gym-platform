import { randomBytes, randomUUID } from 'node:crypto';

import {
  PasswordHasher,
  type RefreshTokenRecord,
  type SessionRecord,
} from '@nestjs/authentication';
import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { PrismaSessionStore } from '../../../src/modules/auth/stores/prisma-session.store.js';
import { PrismaTokenStore } from '../../../src/modules/auth/stores/prisma-token.store.js';
import { AdminAccountStatusService } from '../../../src/modules/users/services/admin-account-status.service.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('internal atomic account status + revocation (real PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let statusService: AdminAccountStatusService;
  let sessionStore: PrismaSessionStore;
  let tokenStore: PrismaTokenStore;
  const operatorId = randomUUID();
  const backupOperatorId = randomUUID();
  const plainAdminId = randomUUID();
  const ownedIds: string[] = [];
  const beforeAllowlist = process.env.SUPERADMIN_USER_IDS;
  const password = 'StrongPassword123!';
  let passwordHash: string;

  async function seed(role: 'ADMIN' | 'TRAINER' | 'ATHLETE', id = randomUUID()) {
    const email = `atomic-status-${id}@example.test`;
    await prisma.user.create({
      data: { id, email, role, passwordHash, emailVerified: true },
    });
    ownedIds.push(id);
    return { id, email };
  }

  async function assertDeniedAfterRevocation(
    id: string,
    sessionCookie: string,
    accessToken: string,
    refreshToken: string,
  ) {
    const cookie = await request(app.getHttpServer()).get('/users/me').set('Cookie', sessionCookie);
    const jwt = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    const refresh = await request(app.getHttpServer())
      .post('/auth/token/refresh')
      .send({ refreshToken });
    for (const response of [cookie, jwt, refresh]) {
      expect(response.status).toBe(401);
      expect(response.headers['cache-control']).toContain('no-store');
    }
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: { status: true, authInvalidatedAt: true },
    });
    expect(stored.authInvalidatedAt).toBeInstanceOf(Date);
  }

  beforeAll(async () => {
    useTestDatabase();
    process.env.SUPERADMIN_USER_IDS = [operatorId, backupOperatorId].join(',');
    const ref = await Test.createTestingModule({
      imports: [await ConfigModule.forRoot({ isGlobal: true }), AppModule],
    })
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = ref.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();

    prisma = app.get(PrismaService);
    statusService = app.get(AdminAccountStatusService);
    sessionStore = app.get(PrismaSessionStore);
    tokenStore = app.get(PrismaTokenStore);
    passwordHash = await app.get(PasswordHasher).hash(password);
    await seed('ADMIN', operatorId);
    await seed('ADMIN', backupOperatorId);
    await seed('ADMIN', plainAdminId);
  }, 35_000);

  afterAll(async () => {
    try {
      if (prisma && ownedIds.length) {
        await prisma.user.deleteMany({ where: { id: { in: ownedIds } } });
      }
    } finally {
      await app?.close();
      if (beforeAllowlist === undefined) delete process.env.SUPERADMIN_USER_IDS;
      else process.env.SUPERADMIN_USER_IDS = beforeAllowlist;
    }
  }, 25_000);

  it('atomically revokes cookie/refresh and invalidates old JWT across reactivation', async () => {
    const target = await seed('ATHLETE');
    const session = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: target.email, password });
    expect(session.status).toBe(200);
    const cookieHeaders = session.headers['set-cookie'];
    const cookies = Array.isArray(cookieHeaders)
      ? cookieHeaders
      : cookieHeaders
        ? [cookieHeaders]
        : [];
    const sessionCookie = cookies
      .map((value) => value.split(';', 1)[0] ?? '')
      .find((value) => value.startsWith('__Host-sid='))!;
    expect(sessionCookie).toBeTruthy();
    const pair = await request(app.getHttpServer())
      .post('/auth/token')
      .send({ email: target.email, password });
    expect(pair.status).toBe(200);
    const { accessToken, refreshToken } = pair.body as {
      accessToken: string;
      refreshToken: string;
    };
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    const changed = await statusService.transition(operatorId, target.id, 'SUSPEND', 'ACTIVE');
    expect(changed).toEqual({ kind: 'changed', status: 'SUSPENDED' });
    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0);
    expect(
      await prisma.refreshToken.count({
        where: { userId: target.id, revoked: false },
      }),
    ).toBe(0);
    expect(
      await prisma.refreshTokenFamily.count({
        where: { userId: target.id, revokedAt: null },
      }),
    ).toBe(0);
    await assertDeniedAfterRevocation(target.id, sessionCookie, accessToken, refreshToken);

    // Repeat requests remain authorized and harmless.
    await expect(
      statusService.transition(operatorId, target.id, 'SUSPEND', 'ACTIVE'),
    ).resolves.toEqual({ kind: 'unchanged', status: 'SUSPENDED' });
    const beforeReactivation = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
      select: { authInvalidatedAt: true },
    });

    await expect(
      statusService.transition(operatorId, target.id, 'REACTIVATE', 'SUSPENDED'),
    ).resolves.toEqual({ kind: 'changed', status: 'ACTIVE' });
    const afterReactivation = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
      select: { authInvalidatedAt: true },
    });
    expect(afterReactivation.authInvalidatedAt!.getTime()).toBeGreaterThanOrEqual(
      beforeReactivation.authInvalidatedAt!.getTime(),
    );
    await assertDeniedAfterRevocation(target.id, sessionCookie, accessToken, refreshToken);

    // JWT iat is whole seconds. A newly minted access token one second after
    // reactivation must work; the old one must remain invalid forever.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const newPair = await request(app.getHttpServer())
      .post('/auth/token')
      .send({ email: target.email, password });
    expect(newPair.status).toBe(200);
    const newJwt = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${newPair.body.accessToken}`);
    expect(newJwt.status).toBe(200);
    expect(newJwt.body.id).toBe(target.id);
  }, 25_000);

  it('rejects non-operators, self/backup lockout and stale commands without mutations', async () => {
    const target = await seed('TRAINER');
    await expect(
      statusService.transition(plainAdminId, target.id, 'SUSPEND', 'ACTIVE'),
    ).rejects.toThrow('Insufficient administrative permissions');
    await expect(
      statusService.transition(operatorId, operatorId, 'SUSPEND', 'ACTIVE'),
    ).rejects.toThrow('Suspending an operator or self is not allowed');
    await expect(
      statusService.transition(operatorId, backupOperatorId, 'SUSPEND', 'ACTIVE'),
    ).rejects.toThrow('Suspending an operator or self is not allowed');
    await expect(
      statusService.transition(operatorId, randomUUID(), 'SUSPEND', 'ACTIVE'),
    ).rejects.toThrow('Account not found');
    await prisma.user.update({ where: { id: target.id }, data: { status: 'SUSPENDED' } });
    await expect(
      statusService.transition(operatorId, target.id, 'REACTIVATE', 'ACTIVE'),
    ).rejects.toThrow('Account status changed; refresh before retrying');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(user.status).toBe('SUSPENDED');
    expect(user.authInvalidatedAt).toBeNull();
  });

  it('never revives lingering cookie/refresh credentials when reactivating a legacy suspended account', async () => {
    const target = await seed('ATHLETE');
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: target.email, password });
    expect(login.status).toBe(200);
    const raw = login.headers['set-cookie'];
    const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const cookie = cookies
      .map((c) => c.split(';', 1)[0] ?? '')
      .find((c) => c.startsWith('__Host-sid='))!;
    expect(cookie).toBeTruthy();
    const pair = await request(app.getHttpServer())
      .post('/auth/token')
      .send({ email: target.email, password });
    expect(pair.status).toBe(200);

    // Simulate a historical/externally set state without prior token cleanup.
    await prisma.user.update({ where: { id: target.id }, data: { status: 'SUSPENDED' } });
    expect(await prisma.session.count({ where: { userId: target.id } })).toBeGreaterThan(0);
    expect(
      await prisma.refreshToken.count({ where: { userId: target.id, revoked: false } }),
    ).toBeGreaterThan(0);

    await expect(
      statusService.transition(operatorId, target.id, 'REACTIVATE', 'SUSPENDED'),
    ).resolves.toEqual({ kind: 'changed', status: 'ACTIVE' });

    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: { userId: target.id, revoked: false } })).toBe(
      0,
    );
    expect(
      await prisma.refreshTokenFamily.count({ where: { userId: target.id, revokedAt: null } }),
    ).toBe(0);
    await assertDeniedAfterRevocation(
      target.id,
      cookie,
      pair.body.accessToken,
      pair.body.refreshToken,
    );
  }, 20_000);

  it('serializes a session insert racing against suspension using one user-row lock', async () => {
    const target = await seed('ATHLETE');
    const now = new Date();
    const record: SessionRecord = {
      id: randomBytes(32).toString('hex'),
      userId: target.id,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 3600_000),
      lastActiveAt: now,
    };
    const [suspend, insert] = await Promise.allSettled([
      statusService.transition(operatorId, target.id, 'SUSPEND', 'ACTIVE'),
      sessionStore.createSession(record),
    ]);
    expect(suspend.status).toBe('fulfilled');
    if (suspend.status === 'fulfilled') {
      expect(suspend.value.status).toBe('SUSPENDED');
    }
    expect(['fulfilled', 'rejected']).toContain(insert.status);
    // If insert wins, suspension deletes it; if suspension wins, insert fails.
    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0);
  }, 20_000);

  it('serializes refresh family creation against suspend + tombstone revocation', async () => {
    const target = await seed('ATHLETE');
    const now = new Date();
    const token: RefreshTokenRecord = {
      id: randomBytes(32).toString('hex'),
      familyId: randomBytes(32).toString('hex'),
      userId: target.id,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 3600_000),
      familyExpiresAt: new Date(now.getTime() + 7 * 86400_000),
      claims: { amr: ['pwd'] },
    };
    const [suspend, insert] = await Promise.allSettled([
      statusService.transition(operatorId, target.id, 'SUSPEND', 'ACTIVE'),
      tokenStore.saveRefreshToken(token),
    ]);
    expect(suspend.status).toBe('fulfilled');
    if (suspend.status === 'fulfilled') expect(suspend.value.status).toBe('SUSPENDED');
    expect(['fulfilled', 'rejected']).toContain(insert.status);
    expect(
      await prisma.refreshToken.count({
        where: { userId: target.id, revoked: false },
      }),
    ).toBe(0);
    expect(
      await prisma.refreshTokenFamily.count({
        where: { userId: target.id, revokedAt: null },
      }),
    ).toBe(0);
  }, 20_000);
});
