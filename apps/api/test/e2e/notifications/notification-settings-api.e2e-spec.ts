import { randomUUID } from 'node:crypto';
import { PasswordHasher } from '@nestjs/authentication';
import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { NotificationSettingsService } from '../../../src/modules/notifications/services/notification-settings.service.js';
import { NotificationsModule } from '../../../src/modules/notifications/notifications.module.js';
import {
  defaultNotificationSettings,
  defaultNotificationPreferences,
} from '../../../src/modules/notifications/domain/notification-settings.policy.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('account notification settings HTTP + PostgreSQL', () => {
  const path = '/users/me/notification-settings';
  const password = 'StrongPassword123!';
  const owner = randomUUID();
  const other = randomUUID();
  const email = (id: string) => `notification-api-${id}@example.test`;
  const pair = { category: 'TRAINER', channel: 'MOBILE_PUSH' } as const;
  const program = { category: 'PROGRAM', channel: 'MOBILE_PUSH' } as const;
  const expected = {
    ...defaultNotificationSettings,
    timezone: 'UTC',
    preferences: defaultNotificationPreferences.map((value) => ({ ...value, consentedAt: null })),
  };
  let app: INestApplication;
  let prisma: PrismaService;
  let service: NotificationSettingsService;
  let ownerCookie: string;
  let otherCookie: string;
  let token: string;

  async function login(id: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email(id), password })
      .expect(200);
    const header = response.headers['set-cookie'];
    const cookie = (Array.isArray(header) ? header : [header])
      .find((value) => value?.startsWith('__Host-sid='))
      ?.split(';')[0];
    if (!cookie) throw new Error('Expected session cookie');
    return cookie;
  }

  beforeAll(async () => {
    useTestDatabase();
    const moduleRef = await Test.createTestingModule({
      imports: [await ConfigModule.forRoot({ isGlobal: true }), AppModule],
    })
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
    prisma = app.get(PrismaService);
    service = app.select(NotificationsModule).get(NotificationSettingsService, { strict: true });
    const passwordHash = await app.get(PasswordHasher).hash(password);
    await prisma.user.createMany({
      data: [owner, other].map((id) => ({
        id,
        email: email(id),
        passwordHash,
        emailVerified: true,
      })),
    });
    ownerCookie = await login(owner);
    otherCookie = await login(other);
    const response = await request(app.getHttpServer())
      .post('/auth/token')
      .send({ email: email(owner), password })
      .expect(200);
    token = response.body.accessToken as string;
  }, 30_000);

  beforeEach(async () => {
    await prisma.notificationSettings.deleteMany({ where: { userId: { in: [owner, other] } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: [owner, other] } } });
    await prisma.profile.deleteMany({ where: { userId: { in: [owner, other] } } });
    await prisma.user.updateMany({
      where: { id: { in: [owner, other] } },
      data: {
        preferredLocale: null,
        autoRestTimer: null,
        restDurationSeconds: null,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
  });

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.profile.deleteMany({ where: { userId: { in: [owner, other] } } });
        await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
      }
    } finally {
      await app?.close();
    }
  });

  const get = (cookie = ownerCookie) =>
    request(app.getHttpServer()).get(path).set('Cookie', cookie);
  const patch = (cookie = ownerCookie) =>
    request(app.getHttpServer()).patch(path).set('Cookie', cookie);

  it('requires authentication and rejects foreign origin writes', async () => {
    const http = request(app.getHttpServer());
    await http.get(path).expect(401);
    await http.patch(path).send({ quietHoursEnabled: false }).expect(401);
    await patch()
      .set('Origin', 'https://untrusted.example.test')
      .send({ quietHoursEnabled: false })
      .expect(401);
    expect(await prisma.notificationSettings.count({ where: { userId: owner } })).toBe(0);
  });

  it('returns identical defaults to cookie and bearer clients without inserting rows', async () => {
    expect((await get().expect('Cache-Control', 'no-store').expect(200)).body).toEqual(expected);
    expect(
      (
        await request(app.getHttpServer())
          .get(path)
          .set('Authorization', `Bearer ${token}`)
          .expect(200)
      ).body,
    ).toEqual(expected);
    expect(await prisma.notificationSettings.count({ where: { userId: owner } })).toBe(0);
    expect(await prisma.notificationPreference.count({ where: { userId: owner } })).toBe(0);
    expect((await get(otherCookie).expect(200)).body).toEqual(expected);
  });

  it('uses canonical profile timezone and does not accept timezone writes', async () => {
    await prisma.profile.create({ data: { userId: owner, timezone: 'Europe/Kyiv' } });
    expect((await get().expect(200)).body.timezone).toBe('Europe/Kyiv');
    await prisma.profile.update({ where: { userId: owner }, data: { timezone: 'Invalid/Zone' } });
    expect((await get().expect(200)).body.timezone).toBeNull();
    await patch().send({ timezone: 'UTC' }).expect(400);
  });

  it('preserves unrelated fields, locale/workout settings, and another account', async () => {
    await prisma.user.update({
      where: { id: owner },
      data: { preferredLocale: 'uk', autoRestTimer: false, restDurationSeconds: 120 },
    });
    expect(
      (
        await patch()
          .send({ quietHoursEnabled: false, reminderLeadMinutes: 15 })
          .expect('Cache-Control', 'no-store')
          .expect(200)
      ).body,
    ).toEqual({ ...expected, quietHoursEnabled: false, reminderLeadMinutes: 15 });
    const changed = (
      await request(app.getHttpServer())
        .patch(path)
        .set('Authorization', `Bearer ${token}`)
        .send({ quietStartMinute: 1260 })
        .expect(200)
    ).body;
    expect(changed).toEqual({
      ...expected,
      quietHoursEnabled: false,
      reminderLeadMinutes: 15,
      quietStartMinute: 1260,
    });
    expect((await get(otherCookie).expect(200)).body).toEqual(expected);
    expect(
      await prisma.user.findUnique({
        where: { id: owner },
        select: { preferredLocale: true, autoRestTimer: true, restDurationSeconds: true },
      }),
    ).toEqual({ preferredLocale: 'uk', autoRestTimer: false, restDurationSeconds: 120 });
    const profile = (
      await request(app.getHttpServer()).get('/users/me').set('Cookie', ownerCookie).expect(200)
    ).body;
    expect(profile).not.toHaveProperty('notificationSettings');
    expect(profile).not.toHaveProperty('notificationPreferences');
  });

  it('records server timestamps only for explicit consent, preserves them on replay and clears on revoke', async () => {
    await patch()
      .send({ preferences: [{ ...pair, enabled: false }] })
      .expect(200);
    expect(await prisma.notificationPreference.count({ where: { userId: owner } })).toBe(0);
    const before = Date.now();
    const first = (
      await patch()
        .send({ preferences: [{ ...pair, enabled: true }] })
        .expect(200)
    ).body;
    expect(first.preferences[0]).toMatchObject({ ...pair, enabled: true });
    const timestamp = Date.parse(first.preferences[0].consentedAt);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(Date.now());
    expect(first.preferences.slice(1)).toEqual(expected.preferences.slice(1));
    expect(
      (
        await patch()
          .send({ preferences: [{ ...pair, enabled: true }] })
          .expect(200)
      ).body,
    ).toEqual(first);
    expect(
      (
        await patch()
          .send({ preferences: [{ ...pair, enabled: false }] })
          .expect(200)
      ).body,
    ).toEqual(expected);
    expect(
      await prisma.notificationPreference.findUnique({
        where: { userId_category_channel: { userId: owner, ...pair } },
      }),
    ).toMatchObject({ enabled: false, consentedAt: null });
  });

  it('rejects unknown, empty, malformed and duplicate consent inputs and query parameters', async () => {
    for (const input of [
      {},
      { userId: other },
      { quietHoursEnabled: null },
      { reminderLeadMinutes: 30 },
      { quietStartMinute: 1440 },
      { preferences: [] },
      { preferences: [{ ...pair, enabled: true, consentedAt: '2026-11-26' }] },
      {
        preferences: [
          { ...pair, enabled: true },
          { ...pair, enabled: false },
        ],
      },
      { preferences: [{ category: 'MARKETING', channel: 'EMAIL', enabled: true }] },
    ]) {
      await patch().send(input).expect(400);
    }
    await get().query({ userId: other }).expect(400);
    await patch().query({ userId: other }).send({ quietHoursEnabled: false }).expect(400);
    expect((await get().expect(200)).body).toEqual(expected);
  });

  it('validates merged boundaries and rejects the whole mixed write', async () => {
    await patch()
      .send({ quietStartMinute: 480, preferences: [{ ...pair, enabled: true }] })
      .expect(400);
    expect((await get().expect(200)).body).toEqual(expected);
    await patch().send({ quietStartMinute: 480, quietEndMinute: 600 }).expect(200);
    await patch()
      .send({ quietEndMinute: 480, preferences: [{ ...pair, enabled: true }] })
      .expect(400);
    expect((await get().expect(200)).body).toEqual({
      ...expected,
      quietStartMinute: 480,
      quietEndMinute: 600,
    });
  });

  it('serializes first writes and preserves independent fields and consent pairs', async () => {
    await Promise.all([
      patch()
        .send({ quietStartMinute: 1200, preferences: [{ ...pair, enabled: true }] })
        .expect(200),
      patch()
        .send({ reminderLeadMinutes: 1440, preferences: [{ ...program, enabled: true }] })
        .expect(200),
    ]);
    const response = (await get().expect(200)).body;
    expect(response).toMatchObject({ quietStartMinute: 1200, reminderLeadMinutes: 1440 });
    expect(response.preferences.slice(0, 2)).toEqual([
      { ...pair, enabled: true, consentedAt: expect.any(String) },
      { ...program, enabled: true, consentedAt: expect.any(String) },
    ]);
    expect(await prisma.notificationSettings.count({ where: { userId: owner } })).toBe(1);
    expect(await prisma.notificationPreference.count({ where: { userId: owner } })).toBe(2);
  });

  it('serializes conflicting boundary patches and rejects the one creating equal endpoints', async () => {
    const responses = await Promise.all([
      patch().send({ quietStartMinute: 600 }),
      patch().send({ quietEndMinute: 600 }),
    ]);
    expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 400]);
    const body = (await get().expect(200)).body;
    expect(body.quietStartMinute).not.toBe(body.quietEndMinute);
  });

  it('rejects inactive/deleted accounts at the persistence boundary, not only via auth', async () => {
    for (const data of [
      { status: 'SUSPENDED' as const },
      { status: 'ACTIVE' as const, deletedAt: new Date() },
    ]) {
      await prisma.user.update({ where: { id: other }, data });
      await expect(service.get(other)).rejects.toMatchObject({ status: 404 });
      await expect(service.patch(other, { quietHoursEnabled: false })).rejects.toMatchObject({
        status: 404,
      });
    }
    expect(await prisma.notificationSettings.count({ where: { userId: other } })).toBe(0);
  });
});
