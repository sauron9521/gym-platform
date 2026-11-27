import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationWorkerMetricsRegistry } from '#src/common/http-metrics/notification-worker-metrics.registry';
import type { AppEnv } from '#src/common/config/env.schema';
import {
  OUTBOX_BATCH_LIMIT,
  OUTBOX_RETRY_CAP_MS,
  outboxRetryDelayMs,
} from '../domain/outbox-dispatch.policy.js';
import type { OutboxDispatchRepository } from '../repositories/outbox-dispatch.repository.js';
import { OutboxDispatchService } from '../services/outbox-dispatch.service.js';

const claim = { id: 'event', status: 'PROCESSING', attemptCount: 1, leaseUntil: new Date() };

function setup(enabled = true) {
  const repository = {
    claim: vi.fn().mockResolvedValue(claim),
    process: vi.fn().mockResolvedValue('processed'),
    retry: vi.fn().mockResolvedValue('retry'),
  };
  const metrics = new NotificationWorkerMetricsRegistry();
  const service = new OutboxDispatchService(
    repository as unknown as OutboxDispatchRepository,
    new ConfigService<AppEnv, true>({ NOTIFICATION_DISPATCH_ENABLED: enabled }),
    metrics,
  );
  return { service, repository, metrics };
}

describe('OutboxDispatchService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does no database work unless explicitly enabled', async () => {
    const { service, repository } = setup(false);
    await service.dispatch();
    expect(repository.claim).not.toHaveBeenCalled();
  });

  it('bounds each scheduled batch and does not claim again after shutdown', async () => {
    const { service, repository } = setup();
    await service.dispatch();
    expect(repository.claim).toHaveBeenCalledTimes(OUTBOX_BATCH_LIMIT);
    expect(repository.process).toHaveBeenCalledTimes(OUTBOX_BATCH_LIMIT);
    service.onModuleDestroy();
    await service.dispatch();
    expect(repository.claim).toHaveBeenCalledTimes(OUTBOX_BATCH_LIMIT);
  });

  it('stops claiming after shutdown during a batch', async () => {
    const { service, repository } = setup();
    repository.process.mockImplementationOnce(async () => {
      service.onModuleDestroy();
      return 'processed';
    });
    await service.dispatch();
    expect(repository.claim).toHaveBeenCalledOnce();
  });

  it('routes processing failures to bounded retry and never logs payload or raw errors', async () => {
    const { service, repository, metrics } = setup();
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    repository.claim.mockResolvedValueOnce(claim).mockResolvedValueOnce(null);
    repository.process.mockRejectedValueOnce(new Error('private failure payload'));
    await service.dispatch();
    expect(repository.retry).toHaveBeenCalledExactlyOnceWith(claim);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ retry: 1, processed: 0 }));
    expect(error).not.toHaveBeenCalled();
    expect(metrics.render()).toContain(
      'gym_api_notification_outbox_results_total{outcome="retry"} 1',
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain('private failure payload');
  });

  it('does not spin when the database cannot persist retry', async () => {
    const { service, repository, metrics } = setup();
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    repository.process.mockRejectedValueOnce(new Error('private failure'));
    repository.retry.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.dispatch()).resolves.toBeUndefined();
    expect(repository.claim).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledExactlyOnceWith('NOTIFICATION_DISPATCH_BATCH_FAILED');
    expect(metrics.render()).toContain(
      'gym_api_notification_worker_batch_failures_total{worker="outbox"} 1',
    );
  });

  it('reports exhausted claims without invoking the processor', async () => {
    const { service, repository } = setup();
    repository.claim
      .mockResolvedValueOnce({ ...claim, status: 'DEAD_LETTER', leaseUntil: null })
      .mockResolvedValueOnce(null);
    await service.dispatch();
    expect(repository.process).not.toHaveBeenCalled();
  });
});

describe('outbox retry policy', () => {
  it('uses deterministic bounded exponential delay with jitter', () => {
    expect([1, 2, 3, 4, 5].map((attempt) => outboxRetryDelayMs(attempt, 0.5))).toEqual([
      3750, 7500, 15000, 30000, 45000,
    ]);
    expect(outboxRetryDelayMs(1, 0)).toBe(2500);
    expect(outboxRetryDelayMs(100, 1)).toBe(OUTBOX_RETRY_CAP_MS);
    expect(outboxRetryDelayMs(100, 0)).toBe(OUTBOX_RETRY_CAP_MS / 2);
  });
});
