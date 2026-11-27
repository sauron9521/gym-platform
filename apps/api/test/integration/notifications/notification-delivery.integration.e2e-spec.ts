import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { AppEnv } from '../../../src/common/config/env.schema.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { NotificationDeliveryRepository } from '../../../src/modules/notifications/repositories/notification-delivery.repository.js';
import { DELIVERY_MAX_ATTEMPTS } from '../../../src/modules/notifications/domain/notification-delivery.policy.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Optional email delivery state machine (PostgreSQL; no provider)', () => {
  const owner = randomUUID();
  const reviewer = randomUUID();
  const old = new Date('2000-01-01T00:00:00.000Z');
  let prisma: PrismaService;
  let replica: PrismaService;
  let first: NotificationDeliveryRepository;
  let second: NotificationDeliveryRepository;

  beforeAll(async () => {
    useTestDatabase();
    const config = new ConfigService<AppEnv, true>({ DATABASE_URL: process.env.DATABASE_URL! });
    prisma = new PrismaService(config);
    replica = new PrismaService(config);
    await prisma.onModuleInit();
    await replica.onModuleInit();
    first = new NotificationDeliveryRepository(prisma);
    second = new NotificationDeliveryRepository(replica);
    await prisma.user.createMany({
      data: [
        {
          id: owner,
          email: owner + '@example.test',
          passwordHash: 'test-only',
          emailVerified: true,
        },
        {
          id: reviewer,
          email: reviewer + '@example.test',
          passwordHash: 'test-only',
          emailVerified: true,
          role: 'ADMIN',
        },
      ],
    });
  });

  async function cleanup() {
    await prisma.notification.deleteMany({ where: { recipientId: { in: [owner, reviewer] } } });
    await prisma.trainerApplication.deleteMany({ where: { userId: owner } });
    await prisma.notificationPreference.deleteMany({ where: { userId: owner } });
    await prisma.notificationSettings.deleteMany({ where: { userId: owner } });
    await prisma.profile.deleteMany({ where: { userId: owner } });
    await prisma.user.update({
      where: { id: owner },
      data: { status: 'ACTIVE', deletedAt: null, emailVerified: true },
    });
  }
  afterEach(cleanup);
  afterAll(async () => {
    try {
      if (prisma) {
        await cleanup();
        await prisma.user.deleteMany({ where: { id: { in: [owner, reviewer] } } });
      }
    } finally {
      await replica?.onApplicationShutdown();
      await prisma?.onApplicationShutdown();
    }
  });

  async function seed(consent = true) {
    const createdAt = new Date(Date.now() - 1000);
    if (consent)
      await prisma.notificationPreference.upsert({
        where: {
          userId_category_channel: { userId: owner, category: 'ACCOUNT', channel: 'EMAIL' },
        },
        create: {
          userId: owner,
          category: 'ACCOUNT',
          channel: 'EMAIL',
          enabled: true,
          consentedAt: old,
        },
        update: { enabled: true, consentedAt: old },
      });
    await prisma.notificationSettings.upsert({
      where: { userId: owner },
      create: { userId: owner, quietHoursEnabled: false },
      update: { quietHoursEnabled: false },
    });
    const application = await prisma.trainerApplication.create({
      data: {
        userId: owner,
        status: 'REJECTED',
        reviewerId: reviewer,
        reviewedAt: createdAt,
        reviewReason: 'test-only',
      },
    });
    return prisma.notification.create({
      data: {
        recipientId: owner,
        eventId: randomUUID(),
        scope: 'USER',
        category: 'ACCOUNT',
        type: 'trainer.application.reviewed',
        templateKey: 'trainer.application.reviewed',
        resourceType: 'TrainerApplication',
        resourceId: application.id,
        createdAt,
      },
    });
  }

  async function delivery(notificationId: string) {
    return prisma.notificationDelivery.findFirstOrThrow({ where: { notificationId } });
  }

  async function claimFor(notificationId: string, worker = first) {
    const result = await worker.claimEmail();
    if (result?.kind !== 'claimed') throw new Error('Expected a claim');
    expect(result.claim.id).toBe((await delivery(notificationId)).id);
    return result.claim;
  }

  it('deduplicates concurrent planning and claims a logical destination once', async () => {
    const notification = await seed();
    expect(
      new Set(
        await Promise.all([first.planEmail(notification.id), second.planEmail(notification.id)]),
      ),
    ).toEqual(new Set(['planned', 'existing']));
    expect(
      await prisma.notificationDelivery.count({ where: { notificationId: notification.id } }),
    ).toBe(1);
    const [a, b] = await Promise.all([first.claimEmail(), second.claimEmail()]);
    const claimed = a ?? b;
    expect([a, b].filter(Boolean)).toHaveLength(1);
    if (claimed?.kind !== 'claimed') throw new Error('Expected a claim');
    expect(await first.beginSend(claimed.claim)).toBe('ready');
    expect(await second.beginSend(claimed.claim)).toBe('lease_lost');
    expect(await second.complete(claimed.claim, 'accepted')).toBe('recorded');
    expect(await first.complete(claimed.claim, 'accepted')).toBe('lease_lost');
    expect(await first.planEmail(notification.id)).toBe('existing');
    expect(await delivery(notification.id)).toMatchObject({
      status: 'SENT',
      attemptCount: 1,
      claimToken: null,
      leaseUntil: null,
    });
    expect(await prisma.notification.findUnique({ where: { id: notification.id } })).toEqual(
      notification,
    );
  });

  it('denies missing consent, post-event consent, unverified accounts and MFA notifications', async () => {
    const notification = await seed(false);
    expect(await first.planEmail(notification.id)).toBe('ineligible');
    await prisma.notificationPreference.create({
      data: {
        userId: owner,
        category: 'ACCOUNT',
        channel: 'EMAIL',
        enabled: true,
        consentedAt: new Date(),
      },
    });
    expect(await first.planEmail(notification.id)).toBe('ineligible');
    await prisma.notificationPreference.updateMany({
      where: { userId: owner },
      data: { consentedAt: old },
    });
    await prisma.user.update({ where: { id: owner }, data: { emailVerified: false } });
    expect(await first.planEmail(notification.id)).toBe('ineligible');
    await prisma.user.update({ where: { id: owner }, data: { emailVerified: true } });
    await prisma.notification.update({
      where: { id: notification.id },
      data: { type: 'account.security.changed', templateKey: 'account.security.changed' },
    });
    expect(await first.planEmail(notification.id)).toBe('ineligible');
    expect(
      await prisma.notificationDelivery.count({ where: { notificationId: notification.id } }),
    ).toBe(0);
  });

  it('rechecks consent epoch, active recipient and authoritative resource before admission', async () => {
    const revoked = await seed();
    expect(await first.planEmail(revoked.id)).toBe('planned');
    const claim = await claimFor(revoked.id);
    await prisma.notificationPreference.updateMany({
      where: { userId: owner },
      data: { enabled: false, consentedAt: null },
    });
    expect(await first.beginSend(claim)).toBe('cancelled');
    expect(await delivery(revoked.id)).toMatchObject({
      status: 'CANCELLED',
      attemptCount: 0,
      lastErrorCode: 'INELIGIBLE',
    });

    const changed = await seed();
    await first.planEmail(changed.id);
    const changedClaim = await claimFor(changed.id);
    await prisma.notificationPreference.updateMany({
      where: { userId: owner },
      data: { consentedAt: new Date(old.getTime() + 1000) },
    });
    expect(await first.beginSend(changedClaim)).toBe('cancelled');

    const suspended = await seed();
    await first.planEmail(suspended.id);
    const suspendedClaim = await claimFor(suspended.id);
    await prisma.user.update({ where: { id: owner }, data: { status: 'SUSPENDED' } });
    expect(await first.beginSend(suspendedClaim)).toBe('cancelled');
    await prisma.user.update({ where: { id: owner }, data: { status: 'ACTIVE' } });

    const foreign = await seed();
    await first.planEmail(foreign.id);
    const foreignClaim = await claimFor(foreign.id);
    await prisma.notification.update({
      where: { id: foreign.id },
      data: { recipientId: reviewer },
    });
    expect(await first.beginSend(foreignClaim)).toBe('cancelled');
  });

  it('reclaims an abandoned pre-send lease, but never retries ambiguous sends', async () => {
    const notification = await seed();
    await first.planEmail(notification.id);
    const stale = await claimFor(notification.id);
    await prisma.notificationDelivery.update({
      where: { id: stale.id },
      data: { leaseUntil: old },
    });
    const fresh = await claimFor(notification.id, second);
    expect(fresh.token).not.toBe(stale.token);
    expect(await first.beginSend(stale)).toBe('lease_lost');
    expect(await second.beginSend(fresh)).toBe('ready');
    await prisma.notificationDelivery.update({
      where: { id: fresh.id },
      data: { leaseUntil: old },
    });
    expect(await first.claimEmail()).toEqual({ kind: 'terminal' });
    expect(await delivery(notification.id)).toMatchObject({
      status: 'UNKNOWN',
      attemptCount: 1,
      lastErrorCode: 'SEND_OUTCOME_UNKNOWN',
    });
    expect(await second.complete(fresh, 'accepted')).toBe('lease_lost');
    expect(await first.claimEmail()).toBeNull();
  });

  it('bounds definite non-send retries and leaves Inbox unchanged', async () => {
    const notification = await seed();
    await first.planEmail(notification.id);
    for (let attempt = 1; attempt <= DELIVERY_MAX_ATTEMPTS; attempt++) {
      const claim = await claimFor(notification.id);
      expect(await first.beginSend(claim)).toBe('ready');
      expect(await first.complete(claim, 'not_sent_retryable')).toBe('recorded');
      const row = await delivery(notification.id);
      expect(row.attemptCount).toBe(attempt);
      if (attempt < DELIVERY_MAX_ATTEMPTS) {
        expect(row.status).toBe('PENDING');
        expect(row.availableAt.getTime()).toBeGreaterThan(row.lastAttemptAt!.getTime());
        expect(await first.claimEmail()).toBeNull();
        await prisma.notificationDelivery.update({
          where: { id: row.id },
          data: { availableAt: old },
        });
      } else expect(row.status).toBe('DEAD_LETTER');
    }
    expect(await prisma.notification.findUnique({ where: { id: notification.id } })).toEqual(
      notification,
    );
  });

  it('defers quiet hours without spending a send attempt and terminates expired deliveries', async () => {
    const notification = await seed();
    await first.planEmail(notification.id);
    const claim = await claimFor(notification.id);
    const minute = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
    await prisma.notificationSettings.update({
      where: { userId: owner },
      data: {
        quietHoursEnabled: true,
        quietStartMinute: (minute + 1435) % 1440,
        quietEndMinute: (minute + 5) % 1440,
      },
    });
    expect(await first.beginSend(claim)).toBe('deferred');
    expect(await delivery(notification.id)).toMatchObject({
      status: 'PENDING',
      attemptCount: 0,
      lastErrorCode: 'QUIET_HOURS',
    });
    await prisma.notificationDelivery.update({ where: { id: claim.id }, data: { expiresAt: old } });
    expect(await second.claimEmail()).toEqual({ kind: 'terminal' });
    expect(await delivery(notification.id)).toMatchObject({
      status: 'CANCELLED',
      lastErrorCode: 'EXPIRED',
    });
  });

  it('distinguishes definite permanent failure from explicit ambiguous outcome and cascades deletion', async () => {
    for (const outcome of ['not_sent_permanent', 'unknown'] as const) {
      const notification = await seed();
      await first.planEmail(notification.id);
      const claim = await claimFor(notification.id);
      expect(await first.beginSend(claim)).toBe('ready');
      expect(await first.complete(claim, outcome)).toBe('recorded');
      expect((await delivery(notification.id)).status).toBe(
        outcome === 'unknown' ? 'UNKNOWN' : 'DEAD_LETTER',
      );
      await prisma.notification.delete({ where: { id: notification.id } });
      expect(await prisma.notificationDelivery.findUnique({ where: { id: claim.id } })).toBeNull();
    }
  });
  it('fails closed when source state or timezone changes, and enforces delivery storage invariants', async () => {
    const notification = await seed();
    await first.planEmail(notification.id);
    const claim = await claimFor(notification.id);
    await prisma.trainerApplication.update({
      where: { id: notification.resourceId! },
      data: { status: 'PENDING', reviewedAt: null, reviewerId: null, reviewReason: null },
    });
    expect(await first.beginSend(claim)).toBe('cancelled');
    await prisma.trainerApplication.update({
      where: { id: notification.resourceId! },
      data: {
        status: 'REJECTED',
        reviewedAt: notification.createdAt,
        reviewerId: reviewer,
        reviewReason: 'test-only',
      },
    });
    const invalidZone = await seed();
    await first.planEmail(invalidZone.id);
    const zoneClaim = await claimFor(invalidZone.id);
    await prisma.profile.create({ data: { userId: owner, timezone: 'Invalid/Timezone' } });
    expect(await first.beginSend(zoneClaim)).toBe('cancelled');
    await expect(
      prisma.notificationDelivery.update({
        where: { id: zoneClaim.id },
        data: { attemptCount: 6 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.notificationDelivery.update({
        where: { id: zoneClaim.id },
        data: { destinationKey: 'raw-address@example.test' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.notificationDelivery.update({
        where: { id: zoneClaim.id },
        data: { status: 'SENDING' },
      }),
    ).rejects.toThrow();
    expect(await delivery(invalidZone.id)).toMatchObject({
      status: 'CANCELLED',
      attemptCount: 0,
      destinationKey: 'account-email',
    });
  });
});
