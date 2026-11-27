export const OUTBOX_MAX_ATTEMPTS = 5;
export const OUTBOX_LEASE_MS = 30_000;
export const OUTBOX_BATCH_LIMIT = 10;
export const OUTBOX_RETRY_CAP_MS = 60_000;

// Equal jitter: the delay is always positive, bounded, and grows exponentially.
export function outboxRetryDelayMs(attempt: number, jitter = Math.random()): number {
  const ceiling = Math.min(OUTBOX_RETRY_CAP_MS, 5_000 * 2 ** (Math.max(1, attempt) - 1));
  return Math.floor(ceiling * (0.5 + 0.5 * Math.max(0, Math.min(1, jitter))));
}
