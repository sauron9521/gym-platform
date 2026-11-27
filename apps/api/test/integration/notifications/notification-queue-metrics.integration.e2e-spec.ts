import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppEnv } from '../../../src/common/config/env.schema.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import {
  NotificationQueueMetricsService,
  QUEUE_METRIC_COUNT_CAP,
} from '../../../src/common/http-metrics/notification-queue-metrics.service.js';
import { NotificationWorkerMetricsRegistry } from '../../../src/common/http-metrics/notification-worker-metrics.registry.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Bounded notification queue metrics (PostgreSQL)', () => {
  const owner = randomUUID();
  const prefix = 'queue-metrics-' + randomUUID();
  const old = new Date('2000-01-01T00:00:00.000Z');
  const future = new Date('2099-01-01T00:00:00.000Z');
  let prisma: PrismaService;
  let config: ConfigService<AppEnv, true>;
  beforeAll(async () => {
    useTestDatabase();
    config = new ConfigService<AppEnv, true>({
      DATABASE_URL: process.env.DATABASE_URL!,
      NOTIFICATION_DISPATCH_ENABLED: false,
      NOTIFICATION_EMAIL_ENABLED: false,
    });
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
    await prisma.user.create({
      data: { id: owner, email: owner + '@example.test', passwordHash: 'test-only' },
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    try {
      await prisma.notification.deleteMany({ where: { recipientId: owner } });
      await prisma.outboxEvent.deleteMany({ where: { eventKey: { startsWith: prefix } } });
      await prisma.user.deleteMany({ where: { id: owner } });
    } finally {
      await prisma.onApplicationShutdown();
    }
  });
  const render = () =>
    new NotificationQueueMetricsService(
      prisma,
      config,
      new NotificationWorkerMetricsRegistry(),
    ).render();
  function value(text: string, metric: string) {
    const line = text.split('\n').find((row) => row.startsWith(metric + ' '));
    if (!line) throw new Error('Missing sample: ' + metric);
    return Number(line.slice(metric.length + 1));
  }

  it('reports committed states, due age, expired leases and pending expiry without PII', async () => {
    const before = await render();
    expect(value(before, 'gym_api_notification_queue_snapshot_success')).toBe(1);
    for (const [suffix, status, availableAt, leaseUntil] of [
      ['due', 'PENDING', old, null],
      ['future', 'PENDING', future, null],
      ['expired', 'PROCESSING', old, old],
      ['abandoned', 'PROCESSING', old, null],
      ['active', 'PROCESSING', old, future],
      ['dead', 'DEAD_LETTER', old, null],
    ] as const) {
      await prisma.outboxEvent.create({
        data: {
          eventKey: prefix + suffix,
          type: 'private event type',
          schemaVersion: 1,
          occurredAt: old,
          actorUserId: owner,
          payload: { private: 'DO_NOT_EXPORT' },
          status,
          availableAt,
          leaseUntil,
          lastErrorCode: 'private provider response',
        },
      });
    }
    const notification = await prisma.notification.create({
      data: {
        eventId: prefix,
        recipientId: owner,
        scope: 'USER',
        category: 'ACCOUNT',
        type: 'private event type',
        templateKey: 'private event type',
      },
    });
    const base = {
      notificationId: notification.id,
      consentedAt: old,
      expiresAt: future,
      destinationKey: 'account-email',
      channel: 'EMAIL' as const,
    };
    await prisma.notificationDelivery.create({
      data: {
        ...base,
        status: 'UNKNOWN',
        finishedAt: old,
        attemptCount: 1,
        lastErrorCode: 'private response',
      },
    });
    const second = await prisma.notification.create({
      data: {
        eventId: prefix + 'second',
        recipientId: owner,
        scope: 'USER',
        category: 'ACCOUNT',
        type: 'private event type',
        templateKey: 'private event type',
      },
    });
    await prisma.notificationDelivery.create({
      data: {
        ...base,
        notificationId: second.id,
        status: 'PENDING',
        expiresAt: old,
        availableAt: future,
      },
    });
    const third = await prisma.notification.create({
      data: {
        eventId: prefix + 'third',
        recipientId: owner,
        scope: 'USER',
        category: 'ACCOUNT',
        type: 'private event type',
        templateKey: 'private event type',
      },
    });
    await prisma.notificationDelivery.create({
      data: {
        ...base,
        notificationId: third.id,
        status: 'SENDING',
        claimToken: randomUUID(),
        leaseUntil: old,
        attemptCount: 1,
      },
    });
    const after = await render();
    for (const [metric, delta] of [
      ['gym_api_notification_queue_rows{queue="outbox",state="pending"}', 2],
      ['gym_api_notification_queue_rows{queue="outbox",state="processing"}', 3],
      ['gym_api_notification_queue_rows{queue="outbox",state="dead_letter"}', 1],
      ['gym_api_notification_due_rows{queue="outbox"}', 1],
      ['gym_api_notification_expired_leases{queue="outbox"}', 2],
      ['gym_api_notification_queue_rows{queue="delivery",state="unknown"}', 1],
      ['gym_api_notification_expired_leases{queue="delivery"}', 1],
      ['gym_api_notification_expired_pending_deliveries', 1],
      ['gym_api_notification_due_rows{queue="delivery"}', 0],
    ] as const)
      expect(value(after, metric) - value(before, metric)).toBe(delta);
    expect(value(after, 'gym_api_notification_oldest_due_seconds{queue="outbox"}')).toBeGreaterThan(
      1000,
    );
    expect(value(after, 'gym_api_notification_worker_enabled{worker="outbox"}')).toBe(0);
    expect(after).not.toContain(owner);
    expect(after).not.toContain(prefix);
    expect(after).not.toContain('DO_NOT_EXPORT');
    expect(after).not.toContain('private');
    expect(after).not.toContain('account-email');
    expect(
      await prisma.notificationDelivery.count({ where: { notification: { recipientId: owner } } }),
    ).toBe(3);
  });

  it('caps historical counting and leaves all rows intact', async () => {
    await prisma.$executeRaw`
      INSERT INTO outbox_events (id, event_key, type, schema_version, occurred_at, payload, status, available_at, attempt_count)
      SELECT ${prefix} || '-bulk-' || n, ${prefix} || '-bulk-' || n, 'metric-test', 1, statement_timestamp(), '{}'::jsonb, 'PROCESSED', statement_timestamp(), 1
      FROM generate_series(1, ${QUEUE_METRIC_COUNT_CAP + 10}::int) n
    `;
    const result = await render();
    expect(value(result, 'gym_api_notification_queue_rows{queue="outbox",state="processed"}')).toBe(
      QUEUE_METRIC_COUNT_CAP,
    );
    expect(
      await prisma.outboxEvent.count({ where: { eventKey: { startsWith: prefix + '-bulk-' } } }),
    ).toBe(QUEUE_METRIC_COUNT_CAP + 10);
  });
});
