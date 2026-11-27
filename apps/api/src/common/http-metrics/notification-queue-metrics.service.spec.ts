import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '#src/common/config/env.schema';
import type { PrismaService } from '#src/infra/database/index';
import {
  NotificationQueueMetricsService,
  QUEUE_METRIC_CACHE_MS,
} from './notification-queue-metrics.service.js';
import { NotificationWorkerMetricsRegistry } from './notification-worker-metrics.registry.js';

function fixture() {
  const prisma = { $transaction: vi.fn().mockResolvedValue(Array.from({ length: 18 }, () => 0)) };
  const workers = new NotificationWorkerMetricsRegistry();
  const config = new ConfigService<AppEnv, true>({
    NOTIFICATION_DISPATCH_ENABLED: true,
    NOTIFICATION_EMAIL_ENABLED: true,
    SMTP_URL: 'smtp://localhost:1025',
  });
  return {
    prisma,
    workers,
    service: new NotificationQueueMetricsService(
      prisma as unknown as PrismaService,
      config,
      workers,
    ),
  };
}

describe('Notification queue metrics snapshot', () => {
  afterEach(() => vi.restoreAllMocks());

  it('coalesces concurrent scrapes and caches the bounded read', async () => {
    const { prisma, service } = fixture();
    const values = await Promise.all(Array.from({ length: 20 }, () => service.render()));
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 500,
      timeout: 2500,
    });
    expect(new Set(values).size).toBe(1);
    expect(values[0]).toContain('gym_api_notification_queue_snapshot_success 1');
    expect(values[0]).toContain('gym_api_notification_worker_enabled{worker="email"} 1');
    expect(await service.render()).toBe(values[0]);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('omits stale queue gauges on failure and backs off repeated DB work', async () => {
    const { prisma, service } = fixture();
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    expect(await service.render()).toContain('gym_api_notification_queue_rows{queue="outbox"');
    clock.mockReturnValue(QUEUE_METRIC_CACHE_MS + 1);
    prisma.$transaction.mockRejectedValueOnce(new Error('private db credentials'));
    const failed = await service.render();
    expect(failed).toContain('gym_api_notification_queue_snapshot_success 0');
    expect(failed).not.toContain('gym_api_notification_queue_rows{');
    expect(failed).not.toContain('private db credentials');
    expect(await service.render()).toBe(failed);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    clock.mockReturnValue(2 * QUEUE_METRIC_CACHE_MS + 2);
    expect(await service.render()).toContain('gym_api_notification_queue_snapshot_success 1');
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('continues exposing process counters during database failure', async () => {
    const { prisma, workers, service } = fixture();
    prisma.$transaction.mockRejectedValueOnce(new Error('secret'));
    workers.recordOutbox({ processed: 4, retry: 2 });
    workers.recordEmail({ accepted: 3, unknown: 1 });
    workers.batchFailed('email');
    const output = await service.render();
    expect(output).toContain('gym_api_notification_outbox_results_total{outcome="processed"} 4');
    expect(output).toContain('gym_api_notification_email_results_total{outcome="accepted"} 3');
    expect(output).toContain('gym_api_notification_worker_batch_failures_total{worker="email"} 1');
    expect(output).not.toContain('secret');
  });
});

describe('NotificationWorkerMetricsRegistry', () => {
  it('maintains fixed-cardinality counters and cumulative histogram', () => {
    const registry = new NotificationWorkerMetricsRegistry();
    registry.recordEmail({ accepted: 2, unknown: 1, not_sent_retryable: -1 });
    registry.recordEmail({ accepted: 3, terminal: Infinity, cancelled: NaN });
    registry.recordOutbox({ processed: 1, retry: 2, dead_letter: 1 });
    registry.recordOutbox({ processed: 1, retry: 0.2, skipped: -4 });
    registry.recordEmail({ accepted: 0, 'private@example.test': 100 } as never);
    registry.observeEmail(0.03);
    registry.observeEmail(3);
    registry.observeEmail(21);
    registry.observeEmail(-1);
    registry.observeEmail(NaN);
    registry.observeEmail(Infinity);
    const output = registry.render();
    expect(output).toContain('gym_api_notification_email_results_total{outcome="accepted"} 5');
    expect(output).toContain(
      'gym_api_notification_email_results_total{outcome="not_sent_retryable"} 0',
    );
    expect(output).toContain('gym_api_notification_outbox_results_total{outcome="retry"} 2');
    expect(output).toContain(
      'gym_api_notification_email_attempt_duration_seconds_bucket{le="0.05"} 1',
    );
    expect(output).toContain(
      'gym_api_notification_email_attempt_duration_seconds_bucket{le="20"} 2',
    );
    expect(output).toContain(
      'gym_api_notification_email_attempt_duration_seconds_bucket{le="+Inf"} 3',
    );
    expect(output).toContain('gym_api_notification_email_attempt_duration_seconds_count 3');
    expect(output.match(/^gym_api_notification_email_results_total\{/gm)).toHaveLength(8);
    expect(output.match(/^gym_api_notification_outbox_results_total\{/gm)).toHaveLength(5);
    expect(output).not.toContain('private@example.test');
  });
});
