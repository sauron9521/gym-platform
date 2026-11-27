import { Injectable } from '@nestjs/common';

const outboxOutcomes = ['processed', 'skipped', 'dead_letter', 'lease_lost', 'retry'] as const;
const emailOutcomes = [
  'accepted',
  'not_sent_retryable',
  'not_sent_permanent',
  'unknown',
  'terminal',
  'deferred',
  'cancelled',
  'lease_lost',
] as const;
const buckets = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20] as const;
type Counts<T extends string> = Readonly<Partial<Record<T, number>>>;

/** Process-local counters; fixed labels only. No arbitrary keys or payloads retained. */
@Injectable()
export class NotificationWorkerMetricsRegistry {
  private readonly outbox = outboxOutcomes.map(() => 0);
  private readonly email = emailOutcomes.map(() => 0);
  private readonly failures = [0, 0];
  private readonly durations = buckets.map(() => 0);
  private durationCount = 0;
  private durationSum = 0;

  recordOutbox(counts: Counts<(typeof outboxOutcomes)[number]>) {
    for (const [i, key] of outboxOutcomes.entries()) {
      const n = counts[key] ?? 0;
      if (Number.isSafeInteger(n) && n >= 0) this.outbox[i]! += n;
    }
  }
  recordEmail(counts: Counts<(typeof emailOutcomes)[number]>) {
    for (const [i, key] of emailOutcomes.entries()) {
      const n = counts[key] ?? 0;
      if (Number.isSafeInteger(n) && n >= 0) this.email[i]! += n;
    }
  }
  batchFailed(worker: 'outbox' | 'email') {
    if (worker === 'outbox') this.failures[0]!++;
    else if (worker === 'email') this.failures[1]!++;
  }
  observeEmail(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    this.durationCount++;
    this.durationSum += seconds;
    for (const [i, le] of buckets.entries()) if (seconds <= le) this.durations[i]!++;
  }
  render(): string {
    const lines = [
      '# HELP gym_api_notification_outbox_results_total Recorded outbox worker outcomes per process.',
      '# TYPE gym_api_notification_outbox_results_total counter',
      ...outboxOutcomes.map(
        (key, i) =>
          'gym_api_notification_outbox_results_total{outcome="' + key + '"} ' + this.outbox[i],
      ),
      '# HELP gym_api_notification_email_results_total Recorded optional email worker outcomes per process.',
      '# TYPE gym_api_notification_email_results_total counter',
      ...emailOutcomes.map(
        (key, i) =>
          'gym_api_notification_email_results_total{outcome="' + key + '"} ' + this.email[i],
      ),
      '# HELP gym_api_notification_worker_batch_failures_total Worker batches interrupted by failures per process.',
      '# TYPE gym_api_notification_worker_batch_failures_total counter',
      'gym_api_notification_worker_batch_failures_total{worker="outbox"} ' + this.failures[0],
      'gym_api_notification_worker_batch_failures_total{worker="email"} ' + this.failures[1],
      '# HELP gym_api_notification_email_attempt_duration_seconds Optional email adapter attempt latency in seconds.',
      '# TYPE gym_api_notification_email_attempt_duration_seconds histogram',
      ...buckets.map(
        (le, i) =>
          'gym_api_notification_email_attempt_duration_seconds_bucket{le="' +
          le +
          '"} ' +
          this.durations[i],
      ),
      'gym_api_notification_email_attempt_duration_seconds_bucket{le="+Inf"} ' + this.durationCount,
      'gym_api_notification_email_attempt_duration_seconds_count ' + this.durationCount,
      'gym_api_notification_email_attempt_duration_seconds_sum ' + this.durationSum,
      '',
    ];
    return lines.join('\n');
  }
}
