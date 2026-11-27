import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { AppEnv } from '../../../src/common/config/env.schema.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { TrainerReviewRepository } from '../../../src/modules/trainer-onboarding/repositories/trainer-review.repository.js';
import { OutboxDispatchRepository } from '../../../src/modules/notifications/repositories/outbox-dispatch.repository.js';
import { NotificationInboxRepository } from '../../../src/modules/notifications/repositories/notification-inbox.repository.js';
import { NotificationDeliveryRepository } from '../../../src/modules/notifications/repositories/notification-delivery.repository.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Trainer review notification transitions (PostgreSQL)', () => {
  const applicant = randomUUID();
  const reviewer = randomUUID();
  const stranger = randomUUID();
  const old = new Date('1998-01-01T00:00:00.000Z');
  let prisma: PrismaService;
  let reviews: TrainerReviewRepository;
  let dispatcher: OutboxDispatchRepository;
  let inbox: NotificationInboxRepository;
  let delivery: NotificationDeliveryRepository;

  beforeAll(async () => {
    useTestDatabase();
    prisma = new PrismaService(
      new ConfigService<AppEnv, true>({ DATABASE_URL: process.env.DATABASE_URL! }),
    );
    await prisma.onModuleInit();
    reviews = new TrainerReviewRepository(prisma);
    dispatcher = new OutboxDispatchRepository(prisma);
    inbox = new NotificationInboxRepository(prisma);
    delivery = new NotificationDeliveryRepository(prisma);
    await prisma.user.createMany({
      data: [applicant, reviewer, stranger].map((id) => ({
        id,
        email: id + '@example.test',
        passwordHash: 'test-only',
        emailVerified: true,
        role: id === reviewer ? 'ADMIN' : 'ATHLETE',
      })),
    });
  });

  async function cleanup() {
    await prisma.notification.deleteMany({
      where: { recipientId: { in: [applicant, reviewer, stranger] } },
    });
    await prisma.outboxEvent.deleteMany({ where: { actorUserId: { in: [reviewer, stranger] } } });
    await prisma.trainerApplication.deleteMany({ where: { userId: applicant } });
    await prisma.trainerProfile.deleteMany({ where: { userId: applicant } });
    await prisma.notificationPreference.deleteMany({ where: { userId: applicant } });
    await prisma.user.update({ where: { id: applicant }, data: { status: 'ACTIVE' } });
    await prisma.user.update({ where: { id: reviewer }, data: { role: 'ADMIN' } });
  }
  afterEach(cleanup);
  afterAll(async () => {
    try {
      if (prisma) {
        await cleanup();
        await prisma.user.deleteMany({ where: { id: { in: [applicant, reviewer, stranger] } } });
      }
    } finally {
      await prisma?.onApplicationShutdown();
    }
  });

  const seed = () =>
    prisma.trainerApplication.create({
      data: { userId: applicant, applicantNote: 'private application' },
    });
  const key = (id: string, type: string) => 'trainer-application:' + id + ':' + type + ':v1';
  async function dispatch(id: string, type: string, expected = 'processed') {
    const event = await prisma.outboxEvent.findUniqueOrThrow({
      where: { eventKey: key(id, type) },
    });
    await prisma.outboxEvent.update({ where: { id: event.id }, data: { availableAt: old } });
    const claim = await dispatcher.claim();
    expect(claim?.id).toBe(event.id);
    expect(await dispatcher.process(claim!)).toBe(expected);
    return event;
  }
  async function assertOnly(type: string) {
    const rows = (await inbox.list(applicant, { category: 'ACCOUNT' })).data;
    expect(rows).toEqual([
      {
        id: expect.any(String),
        type,
        category: 'ACCOUNT',
        templateKey: type,
        createdAt: expect.any(Date),
        readAt: null,
      },
    ]);
    expect((await inbox.list(reviewer, {})).data).toEqual([]);
    await expect(inbox.detail(stranger, rows[0]!.id)).rejects.toThrow('Notification not found');
    await expect(inbox.markRead(stranger, rows[0]!.id)).rejects.toThrow('Notification not found');
    return rows[0]!;
  }

  it.each(['APPROVE', 'REJECT'] as const)(
    'publishes one private applicant notice on %s, never on denied or repeated writes',
    async (action) => {
      const application = await seed();
      expect((await reviews.decide(application.id, stranger, action, 'private reason')).kind).toBe(
        'forbidden',
      );
      expect(
        await prisma.outboxEvent.count({ where: { actorUserId: { in: [reviewer, stranger] } } }),
      ).toBe(0);
      expect((await reviews.decide(application.id, reviewer, action, 'private reason')).kind).toBe(
        'ok',
      );
      expect((await reviews.decide(application.id, reviewer, action, 'private reason')).kind).toBe(
        'ok',
      );
      expect(
        (await reviews.decide(application.id, reviewer, action, 'different reason')).kind,
      ).toBe('conflict');
      const event = await dispatch(application.id, 'trainer.application.reviewed');
      expect(event.payload).toEqual({
        aggregate: { kind: 'TrainerApplication', id: application.id },
      });
      expect(await prisma.outboxEvent.count({ where: { actorUserId: reviewer } })).toBe(1);
      const item = await assertOnly('trainer.application.reviewed');
      expect(await delivery.planEmail(item.id)).toBe('ineligible');
    },
  );

  it('rolls back approval and profile when the event key conflicts', async () => {
    const application = await seed();
    await prisma.outboxEvent.create({
      data: {
        eventKey: key(application.id, 'trainer.application.reviewed'),
        type: 'trainer.application.reviewed',
        schemaVersion: 1,
        actorUserId: reviewer,
        occurredAt: old,
        payload: { aggregate: { kind: 'TrainerApplication', id: application.id } },
      },
    });
    await expect(
      reviews.decide(application.id, reviewer, 'APPROVE', 'private reason'),
    ).rejects.toThrow('Outbox event key conflict');
    expect(
      (await prisma.trainerApplication.findUniqueOrThrow({ where: { id: application.id } })).status,
    ).toBe('PENDING');
    expect(await prisma.trainerProfile.findUnique({ where: { userId: applicant } })).toBeNull();
  });

  it('revocation hides the prior notice and blocks its planned optional email', async () => {
    const application = await seed();
    await prisma.notificationPreference.create({
      data: {
        userId: applicant,
        category: 'ACCOUNT',
        channel: 'EMAIL',
        enabled: true,
        consentedAt: old,
      },
    });
    await reviews.decide(application.id, reviewer, 'APPROVE', 'private reason');
    await dispatch(application.id, 'trainer.application.reviewed');
    const item = await assertOnly('trainer.application.reviewed');
    expect(await delivery.planEmail(item.id)).toBe('planned');
    const claimed = await delivery.claimEmail();
    if (claimed?.kind !== 'claimed') throw new Error('Missing delivery claim');
    await reviews.decide(application.id, reviewer, 'REVOKE', 'private revocation reason');
    expect(await delivery.beginSend(claimed.claim)).toBe('cancelled');
    await dispatch(application.id, 'trainer.application.revoked');
    await assertOnly('trainer.application.revoked');
    await expect(inbox.detail(applicant, item.id)).rejects.toThrow('Notification not found');
    await expect(inbox.markRead(applicant, item.id)).rejects.toThrow('Notification not found');
    expect(
      await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: claimed.claim.id } }),
    ).toMatchObject({ status: 'CANCELLED', attemptCount: 0 });
  });

  it('skips stale approval and ineligible applicant before dispatch', async () => {
    const application = await seed();
    await reviews.decide(application.id, reviewer, 'APPROVE', 'private reason');
    await reviews.decide(application.id, reviewer, 'REVOKE', 'private reason');
    await dispatch(application.id, 'trainer.application.reviewed', 'skipped');
    await prisma.user.update({ where: { id: applicant }, data: { status: 'SUSPENDED' } });
    await dispatch(application.id, 'trainer.application.revoked', 'skipped');
    expect(await inbox.unreadCount(applicant)).toEqual({ count: 0 });
  });

  it('rejects consent granted after the review even if Inbox dispatch is later', async () => {
    const application = await seed();
    await reviews.decide(application.id, reviewer, 'REJECT', 'private reason');
    const row = await prisma.trainerApplication.findUniqueOrThrow({
      where: { id: application.id },
    });
    const consentedAt = new Date(row.reviewedAt!.getTime() + 1);
    await prisma.notificationPreference.create({
      data: {
        userId: applicant,
        category: 'ACCOUNT',
        channel: 'EMAIL',
        enabled: true,
        consentedAt,
      },
    });
    await dispatch(application.id, 'trainer.application.reviewed');
    const item = await assertOnly('trainer.application.reviewed');
    expect(await delivery.planEmail(item.id)).toBe('ineligible');
  });
});
