import { randomUUID } from 'node:crypto';

import { PasswordHasher } from '@nestjs/authentication';
import type { INestApplication } from '@nestjs/common';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { OutboxDispatchRepository } from '../../../src/modules/notifications/repositories/outbox-dispatch.repository.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Admin notification inbox (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const operatorId = randomUUID();
  const secondOperator = randomUUID();
  const allowlist = operatorId + ',' + secondOperator;
  const priorAllowlist = process.env.SUPERADMIN_USER_IDS;
  const password = 'StrongPassword123!';
  const users: string[] = [];
  const cookies: Record<string, string> = {};
  let pendingId: string;
  let dispatcher: OutboxDispatchRepository;
  let config: ConfigService;

  async function createUser(
    key: string,
    role: 'ATHLETE' | 'TRAINER' | 'ADMIN',
    userId = randomUUID(),
  ) {
    const email = `trainer-review-${key}-${randomUUID()}@example.test`;
    const hasher = app.get(PasswordHasher);
    const user = await prisma.user.create({
      data: {
        id: userId,
        email,
        passwordHash: await hasher.hash(password),
        role,
        emailVerified: true,
      },
      select: { id: true },
    });
    users.push(user.id);

    const login = await request(app.getHttpServer())
      .post(role === 'ADMIN' ? '/auth/admin-login' : '/auth/login')
      .send({ email, password });
    expect(login.status).toBe(200);
    const setCookies = login.headers['set-cookie'];
    const values = Array.isArray(setCookies) ? setCookies : setCookies ? [setCookies] : [];
    const cookie = values
      .map((value) => value.split(';', 1)[0] ?? '')
      .find((value) => value.startsWith(role === 'ADMIN' ? '__Host-admin-sid=' : '__Host-sid='));
    if (!cookie) throw new Error('No test session cookie');
    cookies[key] = cookie;
    return user;
  }

  const asUser = (key: string) => cookies[key] ?? '';
  const path = '/admin/notifications';
  const get = (key = 'operator', url = path) =>
    request(app.getHttpServer()).get(url).set('Cookie', asUser(key));

  beforeAll(async () => {
    useTestDatabase();
    process.env.SUPERADMIN_USER_IDS = allowlist;
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

    await createUser('operator', 'ADMIN', operatorId);
    await createUser('second', 'ADMIN', secondOperator);
    await createUser('plain-admin', 'ADMIN');
    await createUser('athlete', 'ATHLETE');
    await createUser('other', 'ATHLETE');
    dispatcher = app.get(OutboxDispatchRepository);
    config = app.get(ConfigService);

    const apply = await request(app.getHttpServer())
      .post('/trainer-applications')
      .set('Cookie', asUser('athlete'))
      .send({ applicantNote: 'I am a qualified strength coach with multiple certifications.' });
    expect(apply.status).toBe(201);
    pendingId = apply.body.id as string;
  }, 30_000);

  afterAll(async () => {
    try {
      if (prisma && users.length) {
        await prisma.outboxEvent.deleteMany({
          where: {
            actorUserId: operatorId,
            type: { in: ['trainer.application.reviewed', 'trainer.application.revoked'] },
          },
        });
        await prisma.notification.deleteMany({ where: { recipientId: { in: users } } });
        await prisma.outboxEvent.deleteMany({ where: { actorUserId: { in: users } } });
        await prisma.trainerApplication.deleteMany({ where: { userId: { in: users } } });
        await prisma.trainerProfile.deleteMany({ where: { userId: { in: users } } });
        await prisma.user.deleteMany({ where: { id: { in: users } } });
      }
    } finally {
      await app?.close();
      if (priorAllowlist === undefined) delete process.env.SUPERADMIN_USER_IDS;
      else process.env.SUPERADMIN_USER_IDS = priorAllowlist;
    }
  }, 20_000);

  const key = (id: string) => 'trainer-application:' + id + ':admin.trainer.review.required:v1';

  async function dispatch(id: string, expected = 'processed') {
    const event = await prisma.outboxEvent.findUniqueOrThrow({ where: { eventKey: key(id) } });
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: { availableAt: new Date('1997-01-01T00:00:00.000Z') },
    });
    const claim = await dispatcher.claim();
    expect(claim?.id).toBe(event.id);
    expect(await dispatcher.process(claim!)).toBe(expected);
    return event;
  }

  it('publishes once on submission and fans out only to current allowlisted operators', async () => {
    const duplicate = await request(app.getHttpServer())
      .post('/trainer-applications')
      .set('Cookie', asUser('athlete'))
      .send({ applicantNote: 'Duplicate application with different text.' });
    expect(duplicate.status).toBe(409);
    const event = await dispatch(pendingId);
    expect(event.payload).toEqual({ aggregate: { kind: 'TrainerApplication', id: pendingId } });
    const rows = await prisma.notification.findMany({
      where: { eventId: event.id },
      orderBy: { recipientId: 'asc' },
    });
    expect(rows.map((row) => row.recipientId).sort()).toEqual([operatorId, secondOperator].sort());
    expect(rows.every((row) => row.scope === 'ADMIN' && row.category === 'ACCOUNT')).toBe(true);
    const own = rows.find((row) => row.recipientId === operatorId)!;
    const other = rows.find((row) => row.recipientId === secondOperator)!;
    const projection = {
      id: own.id,
      type: 'admin.trainer.review.required',
      category: 'ACCOUNT',
      templateKey: 'admin.trainer.review.required',
      createdAt: own.createdAt.toISOString(),
      readAt: null,
    };
    expect((await get().expect(200)).body).toEqual({ data: [projection], nextCursor: null });
    expect((await get('operator', path + '/unread-count').expect(200)).body).toEqual({ count: 1 });
    await get('operator', path + '/' + other.id).expect(404);
    await get('second', path + '/' + own.id).expect(404);
    const mark = () =>
      request(app.getHttpServer())
        .patch(path + '/' + own.id + '/read')
        .set('Cookie', asUser('operator'))
        .expect(200);
    const read = (await mark()).body;
    expect(read).toEqual({ ...projection, readAt: expect.any(String) });
    expect((await mark()).body).toEqual(read);
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: { status: 'PENDING', processedAt: null },
    });
    await dispatch(pendingId);
    expect(await prisma.notification.count({ where: { eventId: event.id } })).toBe(2);
    expect((await get('operator', path + '/' + own.id).expect(200)).body).toEqual(read);
    expect((await get('second', path + '/unread-count').expect(200)).body).toEqual({ count: 1 });
    await request(app.getHttpServer())
      .post(path + '/read-all')
      .set('Cookie', asUser('second'))
      .expect(204);
    expect((await get('second', path + '/unread-count').expect(200)).body).toEqual({ count: 0 });
    expect((await get('athlete', '/notifications').expect(200)).body.data).toEqual([]);
  });

  it('rejects ordinary sessions, unlisted admins, foreign origins and caller-selected scope', async () => {
    for (const [principal, status] of [
      ['athlete', 401],
      ['plain-admin', 403],
    ] as const) {
      await get(principal).expect(status);
      await request(app.getHttpServer())
        .post(path + '/read-all')
        .set('Cookie', asUser(principal))
        .expect(status);
    }
    const anonymous = await request(app.getHttpServer()).get(path).expect(401);
    expect(anonymous.headers['cache-control']).toContain('no-store');
    await get('operator', path + '?scope=USER').expect(400);
    await get('operator', path + '?category=ACCOUNT').expect(400);
    await get('operator').set('Origin', 'https://foreign.example.test').expect(403);
    const operator = await prisma.user.findUniqueOrThrow({
      where: { id: operatorId },
      select: { email: true },
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: operator.email, password })
      .expect(200);
    const raw = login.headers['set-cookie'];
    const ordinary = (Array.isArray(raw) ? raw : [raw])
      .map((v) => v?.split(';', 1)[0])
      .find((v) => v?.startsWith('__Host-sid='));
    expect(ordinary).toBeTruthy();
    await request(app.getHttpServer()).get(path).set('Cookie', ordinary!).expect(401);
  });

  it('rechecks current permission for all operations and hides a decided application', async () => {
    const row = await prisma.notification.findFirstOrThrow({
      where: { recipientId: operatorId, trainerApplicationId: pendingId, scope: 'ADMIN' },
    });
    config.set('SUPERADMIN_USER_IDS', secondOperator);
    try {
      await get().expect(403);
      await get('operator', path + '/unread-count').expect(403);
      await get('operator', path + '/' + row.id).expect(403);
      await request(app.getHttpServer())
        .patch(path + '/' + row.id + '/read')
        .set('Cookie', asUser('operator'))
        .expect(403);
      await request(app.getHttpServer())
        .post(path + '/read-all')
        .set('Cookie', asUser('operator'))
        .expect(403);
    } finally {
      config.set('SUPERADMIN_USER_IDS', allowlist);
    }
    await prisma.user.update({ where: { id: secondOperator }, data: { role: 'ATHLETE' } });
    try {
      await get('second').expect(403);
    } finally {
      await prisma.user.update({ where: { id: secondOperator }, data: { role: 'ADMIN' } });
    }
    await request(app.getHttpServer())
      .post('/admin/trainer-applications/' + pendingId + '/reject')
      .set('Cookie', asUser('operator'))
      .send({ reason: 'Private moderator reason' })
      .expect(200);
    expect((await get().expect(200)).body.data).toEqual([]);
    await get('operator', path + '/' + row.id).expect(404);
    await request(app.getHttpServer())
      .patch(path + '/' + row.id + '/read')
      .set('Cookie', asUser('operator'))
      .expect(404);
    expect((await get('operator', path + '/unread-count').expect(200)).body).toEqual({ count: 0 });
  });

  it('does not fan out a stale review request or to an invalid allowlist', async () => {
    const apply = async () => {
      const response = await request(app.getHttpServer())
        .post('/trainer-applications')
        .set('Cookie', asUser('athlete'))
        .send({ applicantNote: 'Resubmitting with additional credentials for review.' })
        .expect(201);
      return response.body.id as string;
    };
    const stale = await apply();
    await request(app.getHttpServer())
      .post('/admin/trainer-applications/' + stale + '/reject')
      .set('Cookie', asUser('operator'))
      .send({ reason: 'Decision before dispatch' })
      .expect(200);
    const event = await dispatch(stale, 'skipped');
    expect(await prisma.notification.count({ where: { eventId: event.id } })).toBe(0);
    const next = await apply();
    config.set('SUPERADMIN_USER_IDS', 'malformed');
    try {
      const invalid = await dispatch(next, 'skipped');
      expect(await prisma.notification.count({ where: { eventId: invalid.id } })).toBe(0);
      await get().expect(403);
    } finally {
      config.set('SUPERADMIN_USER_IDS', allowlist);
    }
  });
});
