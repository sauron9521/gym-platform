import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../src/common/config/env.schema.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { NotificationRetentionRepository } from '../../../src/modules/notifications/repositories/notification-retention.repository.js';
import { OutboxDispatchRepository } from '../../../src/modules/notifications/repositories/outbox-dispatch.repository.js';
import { NotificationDeliveryRepository } from '../../../src/modules/notifications/repositories/notification-delivery.repository.js';
import {
  publishOutboxEvent,
  type OutboxEventInput,
} from '../../../src/modules/notifications/public-api.js';
import { RETENTION_BATCH_LIMIT } from '../../../src/modules/notifications/domain/notification-retention.policy.js';
import { recordMfaSecurityEvent } from '../../../src/modules/auth/services/record-mfa-security-event.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Notification retention (PostgreSQL)', () => {
  const athlete = randomUUID(),
    trainer = randomUUID(),
    admin = randomUUID();
  const old = new Date(Date.now() - 120 * 86400_000);
  const recent = new Date(Date.now() - 86400_000);
  let prisma: PrismaService, replica: PrismaService;
  let retention: NotificationRetentionRepository, second: NotificationRetentionRepository;
  let dispatch: OutboxDispatchRepository, delivery: NotificationDeliveryRepository;
  const events: string[] = [];
  beforeAll(async () => {
    useTestDatabase();
    const config = new ConfigService<AppEnv, true>({ DATABASE_URL: process.env.DATABASE_URL! });
    prisma = new PrismaService(config);
    replica = new PrismaService(config);
    await prisma.onModuleInit();
    await replica.onModuleInit();
    retention = new NotificationRetentionRepository(prisma);
    second = new NotificationRetentionRepository(replica);
    dispatch = new OutboxDispatchRepository(
      prisma,
      new ConfigService({
        NOTIFICATION_EMAIL_ENABLED: true,
        NOTIFICATION_DISPATCH_ENABLED: true,
        SMTP_URL: 'smtp://localhost:1025',
      }),
    );
    delivery = new NotificationDeliveryRepository(replica);
    await prisma.user.createMany({
      data: [
        {
          id: athlete,
          email: athlete + '@example.test',
          passwordHash: 'test',
          emailVerified: true,
        },
        {
          id: trainer,
          email: trainer + '@example.test',
          passwordHash: 'test',
          emailVerified: true,
          role: 'TRAINER',
        },
        {
          id: admin,
          email: admin + '@example.test',
          passwordHash: 'test',
          emailVerified: true,
          role: 'ADMIN',
        },
      ],
    });
  });
  async function cleanup() {
    await prisma.notification.deleteMany({
      where: { recipientId: { in: [athlete, trainer, admin] } },
    });
    await prisma.outboxEvent.deleteMany({ where: { id: { in: events } } });
    await prisma.outboxEvent.deleteMany({
      where: { actorUserId: { in: [athlete, trainer, admin] } },
    });
    events.length = 0;
    await prisma.mfaLifecycleAudit.deleteMany({ where: { userId: athlete } });
    await prisma.trainerApplication.deleteMany({ where: { userId: athlete } });
    await prisma.trainingProgramAssignment.deleteMany({ where: { athleteId: athlete } });
    await prisma.trainingProgramVersion.deleteMany({ where: { program: { trainerId: trainer } } });
    await prisma.trainingProgram.deleteMany({ where: { trainerId: trainer } });
    await prisma.trainerAthlete.deleteMany({ where: { athleteId: athlete } });
    await prisma.notificationPreference.deleteMany({ where: { userId: athlete } });
    await prisma.notificationSettings.deleteMany({ where: { userId: athlete } });
  }
  afterEach(cleanup);
  afterAll(async () => {
    try {
      if (prisma) {
        await cleanup();
        await prisma.user.deleteMany({ where: { id: { in: [athlete, trainer, admin] } } });
      }
    } finally {
      await replica?.onApplicationShutdown();
      await prisma?.onApplicationShutdown();
    }
  });

  async function persisted(input: OutboxEventInput, eventKey: string) {
    expect(await prisma.$transaction((tx) => publishOutboxEvent(tx, input))).toBe('inserted');
    const event = await prisma.outboxEvent.update({
      where: { eventKey },
      data: { availableAt: old },
    });
    events.push(event.id);
    const claim = await dispatch.claim();
    expect(claim?.id).toBe(event.id);
    expect(await dispatch.process(claim!)).toBe('processed');
    await prisma.outboxEvent.update({ where: { id: event.id }, data: { processedAt: old } });
    const notification = await prisma.notification.findFirstOrThrow({
      where: { eventId: event.id },
    });
    const historical = await prisma.notification.update({
      where: { id: notification.id },
      data: { createdAt: old, readAt: old },
    });
    return { event, notification: historical, input };
  }
  async function relationship() {
    const relation = await prisma.trainerAthlete.create({
      data: {
        trainerId: trainer,
        athleteId: athlete,
        initiatedById: trainer,
        status: 'DECLINED',
        createdAt: old,
        respondedAt: old,
      },
    });
    const input = {
      type: 'trainer.invitation.declined',
      schemaVersion: 1,
      occurredAt: old,
      actorUserId: athlete,
      payload: { aggregate: { kind: 'TrainerAthlete', id: relation.id } },
    } as const;
    return {
      ...(await persisted(
        input,
        'trainer-relationship:' + relation.id + ':trainer.invitation.declined:v1',
      )),
      relation,
    };
  }
  async function assignment() {
    const relation = await prisma.trainerAthlete.create({
      data: {
        trainerId: trainer,
        athleteId: athlete,
        initiatedById: trainer,
        status: 'ACTIVE',
        createdAt: old,
      },
    });
    const program = await prisma.trainingProgram.create({ data: { trainerId: trainer } });
    const version = await prisma.trainingProgramVersion.create({
      data: {
        programId: program.id,
        version: 1,
        title: 'Retention fixture',
        status: 'PUBLISHED',
        publishedAt: old,
      },
    });
    const source = await prisma.trainingProgramAssignment.create({
      data: {
        versionId: version.id,
        trainerAthleteId: relation.id,
        athleteId: athlete,
        assignedById: trainer,
        status: 'COMPLETED',
        assignedAt: old,
        completedAt: old,
      },
    });
    const input = {
      type: 'program.assignment.completed',
      schemaVersion: 1,
      occurredAt: old,
      actorUserId: athlete,
      payload: { aggregate: { kind: 'TrainingProgramAssignment', id: source.id } },
    } as const;
    return {
      ...(await persisted(
        input,
        'program-assignment:' + source.id + ':program.assignment.completed:v1',
      )),
      source,
    };
  }
  async function review() {
    const application = await prisma.trainerApplication.create({
      data: {
        userId: athlete,
        status: 'REJECTED',
        reviewerId: admin,
        reviewedAt: old,
        reviewReason: 'private',
      },
    });
    const input = {
      type: 'trainer.application.reviewed',
      schemaVersion: 1,
      occurredAt: old,
      actorUserId: admin,
      payload: { aggregate: { kind: 'TrainerApplication', id: application.id } },
    } as const;
    const result = await persisted(
      input,
      'trainer-application:' + application.id + ':trainer.application.reviewed:v1',
    );
    return { ...result, application };
  }
  async function transport(
    notificationId: string,
    status: 'SENT' | 'CANCELLED' | 'UNKNOWN' | 'DEAD_LETTER' | 'PENDING' | 'CLAIMED' | 'SENDING',
    finishedAt = old,
  ) {
    const active = status === 'CLAIMED' || status === 'SENDING';
    const terminal = ['SENT', 'CANCELLED', 'UNKNOWN', 'DEAD_LETTER'].includes(status);
    return prisma.notificationDelivery.create({
      data: {
        notificationId,
        channel: 'EMAIL',
        destinationKey: 'account-email',
        status,
        consentedAt: old,
        createdAt: old,
        expiresAt: recent,
        availableAt: old,
        finishedAt: terminal ? finishedAt : null,
        claimToken: active ? randomUUID() : null,
        leaseUntil: active ? recent : null,
        attemptCount: status === 'PENDING' ? 0 : 1,
      },
    });
  }
  async function replay(eventId: string) {
    // Test only. Production has no replay/reset API.
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: { status: 'PENDING', processedAt: null, availableAt: old },
    });
    const claim = await dispatch.claim();
    expect(claim?.id).toBe(eventId);
    return dispatch.process(claim!);
  }

  it('previews without mutation, atomically removes terminal read Inbox and preserves original event and sources across replay', async () => {
    const a = await relationship(),
      b = await assignment();
    expect(await retention.run('preview')).toMatchObject({ mode: 'preview', inbox: 2, email: 0 });
    expect(await prisma.notification.findUnique({ where: { id: a.notification.id } })).toEqual(
      a.notification,
    );
    expect(
      (await prisma.outboxEvent.findUniqueOrThrow({ where: { id: a.event.id } })).inboxRetiredAt,
    ).toBeNull();
    expect(await retention.run('apply')).toMatchObject({ acquired: true, inbox: 2, email: 0 });
    for (const item of [a, b]) {
      expect(
        await prisma.notification.findUnique({ where: { id: item.notification.id } }),
      ).toBeNull();
      const saved = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: item.event.id } });
      expect(saved.inboxRetiredAt).toBeInstanceOf(Date);
      expect(saved.eventKey).toBe(item.event.eventKey);
      expect(saved.payload).toEqual(item.event.payload);
      expect(await prisma.$transaction((tx) => publishOutboxEvent(tx, item.input))).toBe(
        'existing',
      );
      expect(await replay(item.event.id)).toBe('skipped');
      expect(await prisma.notification.count({ where: { eventId: item.event.id } })).toBe(0);
    }
    expect(await prisma.trainerAthlete.findUnique({ where: { id: a.relation.id } })).toEqual(
      a.relation,
    );
    expect(
      await prisma.trainingProgramAssignment.findUnique({ where: { id: b.source.id } }),
    ).toEqual(b.source);
    expect(await second.run('apply')).toMatchObject({ inbox: 0, email: 0 });
  });

  it('removes only terminal old email history, preserves account notice and blocks direct replanning and replay', async () => {
    const r = await review();
    const sent = await transport(r.notification.id, 'SENT');
    expect(await retention.run('preview')).toMatchObject({ inbox: 0, email: 1 });
    expect(await prisma.notificationDelivery.findUnique({ where: { id: sent.id } })).toEqual(sent);
    expect(await retention.run('apply')).toMatchObject({ inbox: 0, email: 1 });
    expect(await prisma.notificationDelivery.findUnique({ where: { id: sent.id } })).toBeNull();
    const event = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: r.event.id } });
    expect(event.emailRetiredAt).toBeInstanceOf(Date);
    expect(event.inboxRetiredAt).toBeNull();
    expect(await prisma.notification.findUnique({ where: { id: r.notification.id } })).toEqual(
      r.notification,
    );
    expect(await prisma.trainerApplication.findUnique({ where: { id: r.application.id } })).toEqual(
      r.application,
    );
    expect(await delivery.planEmail(r.notification.id)).toBe('existing');
    expect(await replay(r.event.id)).toBe('processed');
    expect(
      await prisma.notificationDelivery.count({ where: { notificationId: r.notification.id } }),
    ).toBe(0);
    expect(await delivery.complete({ id: sent.id, token: randomUUID() }, 'accepted')).toBe(
      'lease_lost',
    );
    expect(await second.run('apply')).toMatchObject({ inbox: 0, email: 0 });
  });

  it('preserves unread, recently read, unrecognized, security, admin, active and unresolved delivery records', async () => {
    const a = await relationship(),
      b = await relationship(),
      c = await relationship(),
      d = await relationship();
    await prisma.notification.update({ where: { id: a.notification.id }, data: { readAt: null } });
    await prisma.notification.update({
      where: { id: b.notification.id },
      data: { readAt: recent },
    });
    await prisma.notification.update({
      where: { id: c.notification.id },
      data: { templateKey: 'unrecognized' },
    });
    await transport(d.notification.id, 'UNKNOWN'); // unexpected transport must block Inbox cascade
    await prisma.$transaction((tx) => recordMfaSecurityEvent(tx, athlete, 'FIRST_TOTP_CONFIRMED'));
    const audit = await prisma.mfaLifecycleAudit.findFirstOrThrow({ where: { userId: athlete } });
    const security = await prisma.outboxEvent.findFirstOrThrow({
      where: { actorUserId: athlete, type: 'account.security.changed' },
    });
    events.push(security.id);
    await prisma.outboxEvent.update({ where: { id: security.id }, data: { availableAt: old } });
    expect(await dispatch.process((await dispatch.claim())!)).toBe('processed');
    await prisma.outboxEvent.update({
      where: { id: security.id },
      data: { processedAt: old, occurredAt: old },
    });
    await prisma.notification.updateMany({
      where: { eventId: security.id },
      data: { createdAt: old, readAt: old },
    });
    const r = await review();
    const preserved = await transport(r.notification.id, 'UNKNOWN');
    for (const status of ['UNKNOWN', 'DEAD_LETTER', 'PENDING', 'CLAIMED', 'SENDING'] as const) {
      await prisma.notificationDelivery.update({
        where: { id: preserved.id },
        data: {
          status,
          finishedAt: ['UNKNOWN', 'DEAD_LETTER'].includes(status) ? old : null,
          claimToken: ['CLAIMED', 'SENDING'].includes(status) ? randomUUID() : null,
          leaseUntil: ['CLAIMED', 'SENDING'].includes(status) ? recent : null,
        },
      });
      expect(await retention.run('apply')).toMatchObject({ inbox: 0, email: 0 });
      expect(
        await prisma.notificationDelivery.findUnique({ where: { id: preserved.id } }),
      ).not.toBeNull();
    }
    expect(await prisma.mfaLifecycleAudit.findUnique({ where: { id: audit.id } })).toEqual(audit);
    expect(
      await prisma.notification.count({
        where: {
          eventId: {
            in: [a.event.id, b.event.id, c.event.id, d.event.id, security.id, r.event.id],
          },
        },
      }),
    ).toBe(6);
  });

  it('holds an admin notice, a pending event and recent terminal transport', async () => {
    const a = await relationship();
    await prisma.outboxEvent.update({
      where: { id: a.event.id },
      data: { status: 'PENDING', processedAt: null },
    });
    const reviewSource = await prisma.trainerApplication.create({
      data: { userId: athlete, status: 'PENDING', createdAt: old },
    });
    const adminEvent = await prisma.outboxEvent.create({
      data: {
        eventKey: 'trainer-application:' + reviewSource.id + ':admin.trainer.review.required:v1',
        type: 'admin.trainer.review.required',
        schemaVersion: 1,
        actorUserId: athlete,
        occurredAt: old,
        processedAt: old,
        status: 'PROCESSED',
        payload: { aggregate: { kind: 'TrainerApplication', id: reviewSource.id } },
      },
    });
    events.push(adminEvent.id);
    const adminNotice = await prisma.notification.create({
      data: {
        eventId: adminEvent.id,
        recipientId: admin,
        scope: 'ADMIN',
        category: 'ACCOUNT',
        type: adminEvent.type,
        templateKey: adminEvent.type,
        trainerApplicationId: reviewSource.id,
        createdAt: old,
        readAt: old,
      },
    });
    expect(await retention.run('apply')).toMatchObject({ inbox: 0, email: 0 });
    expect(await prisma.notification.findUnique({ where: { id: adminNotice.id } })).toEqual(
      adminNotice,
    );
    expect(await prisma.notification.findUnique({ where: { id: a.notification.id } })).toEqual(
      a.notification,
    );
    await prisma.outboxEvent.update({ where: { id: a.event.id }, data: { status: 'DEAD_LETTER' } });
    await prisma.trainerApplication.delete({ where: { id: reviewSource.id } });
    const r = await review();
    const recentDelivery = await transport(r.notification.id, 'CANCELLED', recent);
    expect(await retention.run('apply')).toMatchObject({ inbox: 0, email: 0 });
    expect(
      await prisma.notificationDelivery.findUnique({ where: { id: recentDelivery.id } }),
    ).toEqual(recentDelivery);
    await prisma.notificationDelivery.update({
      where: { id: recentDelivery.id },
      data: { finishedAt: old },
    });
    expect(await retention.run('apply')).toMatchObject({ inbox: 0, email: 1 });
    expect(await prisma.notification.findUnique({ where: { id: r.notification.id } })).toEqual(
      r.notification,
    );
  });

  it('rolls back retirement marker and deletion together when SQL delete fails', async () => {
    const a = await relationship();
    // Test-only failpoint in the guarded disposable database. No live DB access.
    await prisma.$executeRaw`CREATE FUNCTION retention_test_fail_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'retention-test-failure'; END; $$`;
    try {
      await prisma.$executeRaw`CREATE TRIGGER retention_test_fail_delete BEFORE DELETE ON notifications FOR EACH ROW EXECUTE FUNCTION retention_test_fail_delete()`;
      try {
        await expect(retention.run('apply')).rejects.toThrow();
        expect(
          (await prisma.outboxEvent.findUniqueOrThrow({ where: { id: a.event.id } }))
            .inboxRetiredAt,
        ).toBeNull();
        expect(await prisma.notification.findUnique({ where: { id: a.notification.id } })).toEqual(
          a.notification,
        );
      } finally {
        await prisma.$executeRaw`DROP TRIGGER retention_test_fail_delete ON notifications`;
      }
    } finally {
      await prisma.$executeRaw`DROP FUNCTION retention_test_fail_delete()`;
    }
    expect(await retention.run('apply')).toMatchObject({ inbox: 1, email: 0 });
  });

  it('skips locked event and serializes cleanup replicas without duplicates', async () => {
    const a = await relationship();
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM outbox_events WHERE id = ${a.event.id} FOR UPDATE`;
      expect(await second.run('apply')).toMatchObject({ inbox: 0, email: 0 });
    });
    const results = await Promise.all([retention.run('apply'), second.run('apply')]);
    expect(results.reduce((sum, r) => sum + r.inbox, 0)).toBe(1);
    expect(await prisma.notification.count({ where: { eventId: a.event.id } })).toBe(0);
  });

  it('bounds preview and apply to a batch per channel', async () => {
    for (let i = 0; i < RETENTION_BATCH_LIMIT + 1; i++) {
      const relation = await prisma.trainerAthlete.create({
        data: {
          trainerId: trainer,
          athleteId: athlete,
          initiatedById: trainer,
          status: 'DECLINED',
          respondedAt: old,
          createdAt: old,
        },
      });
      const type = 'trainer.invitation.declined';
      const event = await prisma.outboxEvent.create({
        data: {
          type,
          eventKey: 'trainer-relationship:' + relation.id + ':' + type + ':v1',
          schemaVersion: 1,
          actorUserId: athlete,
          occurredAt: old,
          processedAt: old,
          status: 'PROCESSED',
          payload: { aggregate: { kind: 'TrainerAthlete', id: relation.id } },
        },
      });
      events.push(event.id);
      await prisma.notification.create({
        data: {
          eventId: event.id,
          recipientId: trainer,
          scope: 'USER',
          category: 'TRAINER',
          type,
          templateKey: type,
          trainerRelationshipId: relation.id,
          readAt: old,
          createdAt: old,
        },
      });
    }
    expect(await retention.run('preview')).toMatchObject({
      inbox: RETENTION_BATCH_LIMIT,
      email: 0,
    });
    expect(await retention.run('apply')).toMatchObject({ inbox: RETENTION_BATCH_LIMIT, email: 0 });
    expect(await retention.run('apply')).toMatchObject({ inbox: 1, email: 0 });
    expect(await retention.run('apply')).toMatchObject({ inbox: 0, email: 0 });
  });
});
