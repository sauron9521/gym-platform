import { randomUUID } from 'node:crypto';
import { PasswordHasher } from '@nestjs/authentication';
import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { recordMfaSecurityEvent } from '../../../src/modules/auth/services/record-mfa-security-event.js';
import { NotificationsModule } from '../../../src/modules/notifications/notifications.module.js';
import { OutboxDispatchRepository } from '../../../src/modules/notifications/repositories/outbox-dispatch.repository.js';
import { OutboxDispatchService } from '../../../src/modules/notifications/services/outbox-dispatch.service.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Notification inbox HTTP + PostgreSQL', () => {
  const path = '/notifications';
  const owner = randomUUID();
  const other = randomUUID();
  const password = 'Test-only inbox password!';
  const email = (id: string) => 'inbox-' + id + '@example.test';
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  let bearer: string;

  function http() {
    return request(app.getHttpServer());
  }
  const get = (url = path) => http().get(url).set('Cookie', cookie);
  const mark = (id: string) =>
    http()
      .patch(path + '/' + id + '/read')
      .set('Cookie', cookie);

  async function seed(
    recipientId = owner,
    options: {
      scope?: 'USER' | 'ADMIN';
      createdAt?: Date;
      expiresAt?: Date;
      readAt?: Date;
      eventId?: string;
      type?: string;
    } = {},
  ) {
    return prisma.notification.create({
      data: {
        recipientId,
        eventId: randomUUID(),
        scope: 'USER',
        category: 'ACCOUNT',
        type: 'account.security.changed',
        templateKey: 'account.security.changed',
        resourceType: 'private-audit',
        resourceId: randomUUID(),
        ...options,
      },
    });
  }

  beforeAll(async () => {
    useTestDatabase();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
    prisma = app.get(PrismaService);
    const passwordHash = await app.get(PasswordHasher).hash(password);
    await prisma.user.createMany({
      data: [owner, other].map((id) => ({
        id,
        email: email(id),
        passwordHash,
        emailVerified: true,
      })),
    });
    const login = await http()
      .post('/auth/login')
      .send({ email: email(owner), password })
      .expect(200);
    const header = login.headers['set-cookie'];
    const value = (Array.isArray(header) ? header : [header])
      .find((v) => v?.startsWith('__Host-sid='))
      ?.split(';')[0];
    if (!value) throw new Error('Missing session');
    cookie = value;
    const token = await http()
      .post('/auth/token')
      .send({ email: email(owner), password })
      .expect(200);
    bearer = 'Bearer ' + String(token.body.accessToken);
  }, 30_000);

  beforeEach(async () => {
    await prisma.notification.deleteMany({ where: { recipientId: { in: [owner, other] } } });
  });

  afterAll(async () => {
    try {
      await prisma?.user.deleteMany({ where: { id: { in: [owner, other] } } });
    } finally {
      await app?.close();
    }
  }, 20_000);

  it('requires authentication and gives private no-store responses even on errors', async () => {
    await http().get(path).expect('Cache-Control', 'no-store').expect(401);
    await http()
      .get(path + '/unread-count')
      .expect(401);
    await http()
      .patch(path + '/' + randomUUID() + '/read')
      .expect(401);
    await http()
      .post(path + '/read-all')
      .expect(401);
  });

  it('returns only safe owner projections to cookie and bearer clients', async () => {
    const row = await seed();
    const foreign = await seed(other);
    const admin = await seed(owner, { scope: 'ADMIN' });
    const expired = await seed(owner, { expiresAt: new Date(0) });
    const unknown = await seed(owner, { type: 'unknown.private.event' });
    const expected = {
      id: row.id,
      type: row.type,
      category: row.category,
      templateKey: row.templateKey,
      createdAt: row.createdAt.toISOString(),
      readAt: null,
    };
    expect((await get().expect('Cache-Control', 'no-store').expect(200)).body).toEqual({
      data: [expected],
      nextCursor: null,
    });
    expect((await http().get(path).set('Authorization', bearer).expect(200)).body).toEqual({
      data: [expected],
      nextCursor: null,
    });
    expect((await get(path + '/' + row.id).expect(200)).body).toEqual(expected);
    for (const id of [foreign.id, admin.id, expired.id, unknown.id, randomUUID()]) {
      await get(path + '/' + id)
        .expect('Cache-Control', 'no-store')
        .expect(404);
      await http()
        .patch(path + '/' + id + '/read')
        .set('Authorization', bearer)
        .expect(404);
    }
    expect((await get(path + '/unread-count').expect(200)).body).toEqual({ count: 1 });
    expect(
      await prisma.notification.count({
        where: { readAt: { not: null }, recipientId: { in: [owner, other] } },
      }),
    ).toBe(0);
  });

  it('uses stable keyset pagination across ties and inserted newer rows', async () => {
    const createdAt = new Date('2026-11-20T12:00:00.000Z');
    const rows = await Promise.all(Array.from({ length: 5 }, () => seed(owner, { createdAt })));
    const sorted = rows
      .map((r) => r.id)
      .sort()
      .reverse();
    const first = (await get(path + '?limit=2').expect(200)).body;
    expect(first.data.map((r: { id: string }) => r.id)).toEqual(sorted.slice(0, 2));
    await seed();
    await prisma.notification.delete({ where: { id: sorted[1] } });
    const second = (
      await get(path + '?limit=2&cursor=' + encodeURIComponent(first.nextCursor)).expect(200)
    ).body;
    expect(second.data.map((r: { id: string }) => r.id)).toEqual(sorted.slice(2, 4));
    const third = (
      await get(path + '?limit=2&cursor=' + encodeURIComponent(second.nextCursor)).expect(200)
    ).body;
    expect(third.data.map((r: { id: string }) => r.id)).toEqual(sorted.slice(4));
    expect(third.nextCursor).toBeNull();
  });

  it('marks one and all visible rows read idempotently', async () => {
    const first = await seed();
    const second = await seed();
    const foreign = await seed(other);
    const admin = await seed(owner, { scope: 'ADMIN' });
    const expired = await seed(owner, { expiresAt: new Date(0) });
    const unknown = await seed(owner, { type: 'unknown.private.event' });
    await mark(first.id).set('Origin', 'https://untrusted.example.test').expect(401);
    const [a, b] = await Promise.all([mark(first.id).expect(200), mark(first.id).expect(200)]);
    expect(a.body.readAt).toBeTruthy();
    expect(b.body.readAt).toBe(a.body.readAt);
    expect(
      (await get(path + '?unread=true').expect(200)).body.data.map((r: { id: string }) => r.id),
    ).toEqual([second.id]);
    expect(
      (await get(path + '?unread=false&category=ACCOUNT').expect(200)).body.data.map(
        (r: { id: string }) => r.id,
      ),
    ).toEqual([first.id]);
    expect((await get(path + '?category=PROGRAM').expect(200)).body.data).toEqual([]);
    await http()
      .post(path + '/read-all')
      .set('Authorization', bearer)
      .expect(204);
    const saved = await prisma.notification.findUniqueOrThrow({ where: { id: second.id } });
    expect(saved.readAt).not.toBeNull();
    await http()
      .post(path + '/read-all')
      .set('Cookie', cookie)
      .expect(204);
    expect(
      (await prisma.notification.findUniqueOrThrow({ where: { id: second.id } })).readAt,
    ).toEqual(saved.readAt);
    expect((await get(path + '/unread-count').expect(200)).body).toEqual({ count: 0 });
    expect(
      await prisma.notification.count({
        where: { id: { in: [foreign.id, admin.id, expired.id, unknown.id] }, readAt: null },
      }),
    ).toBe(4);
  });

  it('rejects malformed inputs and enforces recipient/scope deduplication', async () => {
    for (const query of [
      'limit=0',
      'limit=51',
      'limit=2.5',
      'limit=1&limit=2',
      'unread=1',
      'category=ADMIN',
      'recipientId=' + other,
      'cursor=bad',
    ]) {
      await get(path + '?' + query)
        .expect('Cache-Control', 'no-store')
        .expect(400);
    }
    await get(path + '/bad-id').expect(400);
    const row = await seed();
    await expect(seed(owner, { eventId: row.eventId })).rejects.toMatchObject({ code: 'P2002' });
    await seed(owner, { eventId: row.eventId, scope: 'ADMIN' });
    await seed(other, { eventId: row.eventId });
    expect((await get().expect(200)).body.data).toHaveLength(1);
  });
  it('installs the recipient cursor and unread indexes and cascades recipient deletion', async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = current_schema() AND tablename = 'notifications'
    `;
    expect(
      indexes.find((row) => row.indexname === 'notifications_recipient_scope_cursor_idx')?.indexdef,
    ).toContain('(recipient_id, scope, created_at DESC, id DESC)');
    expect(
      indexes.find((row) => row.indexname === 'notifications_recipient_scope_read_idx')?.indexdef,
    ).toContain('(recipient_id, scope, read_at)');
    const temporaryOwner = randomUUID();
    await prisma.user.create({
      data: { id: temporaryOwner, email: email(temporaryOwner), passwordHash: 'test-only' },
    });
    try {
      const row = await seed(temporaryOwner);
      await prisma.user.delete({ where: { id: temporaryOwner } });
      expect(await prisma.notification.findUnique({ where: { id: row.id } })).toBeNull();
    } finally {
      await prisma.user.deleteMany({ where: { id: temporaryOwner } });
    }
  });
  it('publishes a real lifecycle event and exposes it through the authenticated Inbox only after dispatch', async () => {
    const core = app.select(NotificationsModule);
    const repository = core.get(OutboxDispatchRepository, { strict: true });
    const scheduler = core.get(OutboxDispatchService, { strict: true });
    try {
      await prisma.$transaction((tx) => recordMfaSecurityEvent(tx, owner, 'FIRST_TOTP_CONFIRMED'));
      const event = await prisma.outboxEvent.findFirstOrThrow({ where: { actorUserId: owner } });
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { availableAt: new Date('2000-01-01T00:00:00.000Z') },
      });
      // Default-off must leave even an available event untouched.
      await scheduler.dispatch();
      expect((await get(path + '/unread-count').expect(200)).body).toEqual({ count: 0 });
      expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).status).toBe(
        'PENDING',
      );
      const claim = await repository.claim();
      expect(claim?.id).toBe(event.id);
      expect(await repository.process(claim!)).toBe('processed');
      const inbox = (await get().expect(200)).body;
      expect(inbox.data).toEqual([
        {
          id: expect.any(String),
          type: 'account.security.changed',
          category: 'ACCOUNT',
          templateKey: 'account.security.changed',
          createdAt: expect.any(String),
          readAt: null,
        },
      ]);
      expect((await get(path + '/unread-count').expect(200)).body).toEqual({ count: 1 });
      await mark(inbox.data[0].id).expect(200);
      expect((await get(path + '/unread-count').expect(200)).body).toEqual({ count: 0 });
    } finally {
      await prisma.notification.deleteMany({ where: { recipientId: owner } });
      await prisma.outboxEvent.deleteMany({ where: { actorUserId: owner } });
      await prisma.mfaLifecycleAudit.deleteMany({ where: { userId: owner } });
    }
  });
  it('exposes only an authorized semantic program target and suppresses it after revocation', async () => {
    await prisma.user.update({ where: { id: other }, data: { role: 'TRAINER' } });
    const relationship = await prisma.trainerAthlete.create({
      data: {
        trainerId: other,
        athleteId: owner,
        initiatedById: other,
        status: 'ACTIVE',
        respondedAt: new Date(),
      },
    });
    const program = await prisma.trainingProgram.create({
      data: {
        trainerId: other,
        status: 'PUBLISHED',
        versions: {
          create: {
            title: 'Private title',
            version: 1,
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        },
      },
      include: { versions: true },
    });
    try {
      const assignment = await prisma.trainingProgramAssignment.create({
        data: {
          versionId: program.versions[0]!.id,
          trainerAthleteId: relationship.id,
          athleteId: owner,
          assignedById: other,
        },
      });
      const item = await prisma.notification.create({
        data: {
          eventId: randomUUID(),
          recipientId: owner,
          scope: 'USER',
          category: 'PROGRAM',
          type: 'program.assigned',
          templateKey: 'program.assigned',
          programAssignmentId: assignment.id,
        },
      });
      const expected = {
        id: item.id,
        type: 'program.assigned',
        category: 'PROGRAM',
        templateKey: 'program.assigned',
        createdAt: item.createdAt.toISOString(),
        readAt: null,
        target: { kind: 'PROGRAM_ASSIGNMENT', id: assignment.id },
      };
      expect((await get(path + '?category=PROGRAM').expect(200)).body).toEqual({
        data: [expected],
        nextCursor: null,
      });
      expect(
        (
          await http()
            .get(path + '/' + item.id)
            .set('Authorization', bearer)
            .expect(200)
        ).body,
      ).toEqual(expected);
      expect((await mark(item.id).expect(200)).body).toEqual({
        ...expected,
        readAt: expect.any(String),
      });
      await prisma.trainerProfile.create({ data: { userId: other, isActive: false } });
      await get(path + '/' + item.id).expect(404);
      await mark(item.id).expect(404);
      expect((await get(path + '?category=PROGRAM').expect(200)).body).toEqual({
        data: [],
        nextCursor: null,
      });
    } finally {
      await prisma.trainingProgramAssignment.deleteMany({
        where: { trainerAthleteId: relationship.id },
      });
      await prisma.trainingProgramVersion.deleteMany({ where: { programId: program.id } });
      await prisma.trainingProgram.delete({ where: { id: program.id } });
      await prisma.trainerAthlete.delete({ where: { id: relationship.id } });
      await prisma.trainerProfile.deleteMany({ where: { userId: other } });
      await prisma.user.update({ where: { id: other }, data: { role: 'ATHLETE' } });
    }
  });
  it('fences all Inbox operations to the expected authenticated owner without changing authorization', async () => {
    const item = await seed();
    const header = 'x-inbox-owner';
    await get().set(header, other).expect(409);
    await get(path + '/unread-count')
      .set(header, other)
      .expect(409);
    await get(path + '/' + item.id)
      .set(header, other)
      .expect(409);
    await mark(item.id).set(header, other).expect(409);
    await http()
      .post(path + '/read-all')
      .set('Cookie', cookie)
      .set(header, other)
      .expect(409);
    expect(
      (await prisma.notification.findUniqueOrThrow({ where: { id: item.id } })).readAt,
    ).toBeNull();
    await get().set(header, owner).expect(200);
    await get(path + '/' + item.id)
      .set(header, owner)
      .expect(200);
    await mark(item.id).set(header, owner).expect(200);
    await http().get(path).set(header, owner).expect(401);
  });
});
