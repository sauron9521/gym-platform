import { AsyncLocalStorage } from 'node:async_hooks';

type Timing = {
  active: boolean;
  started: number;
  completed: number;
  failed: number;
  totalMs: number;
  maxMs: number;
};
const storage = new AsyncLocalStorage<Timing>();

export function createRequestDatabaseTiming() {
  const timing: Timing = {
    active: true,
    started: 0,
    completed: 0,
    failed: 0,
    totalMs: 0,
    maxMs: 0,
  };
  return {
    run: <T>(callback: () => T): T => storage.run(timing, callback),
    finish() {
      timing.active = false;
      return {
        databaseCallsStarted: timing.started,
        databaseCallsCompleted: timing.completed,
        databaseCallsFailed: timing.failed,
        databaseCallTotalMs: Math.round(timing.totalMs * 100) / 100,
        databaseCallMaxMs: Math.round(timing.maxMs * 100) / 100,
      };
    },
  };
}

/** Capture the caller's scope before invoking the driver. Never inspect SQL,
 * parameters, result, or error. Detached work after response settlement and
 * background jobs do not contribute to an HTTP request. */
export function measureRequestDatabaseCall<T>(operation: () => Promise<T>): Promise<T> {
  const timing = storage.getStore();
  if (!timing?.active) return operation();
  const start = process.hrtime.bigint();
  timing.started++;
  const complete = (failed: boolean) => {
    if (!timing.active) return;
    const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
    timing.completed++;
    if (failed) timing.failed++;
    timing.totalMs += duration;
    timing.maxMs = Math.max(timing.maxMs, duration);
  };
  return (async () => {
    try {
      const result = await operation();
      complete(false);
      return result;
    } catch (error) {
      complete(true);
      throw error;
    }
  })();
}
