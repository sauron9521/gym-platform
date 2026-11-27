import { describe, expect, it } from 'vitest';
import {
  createRequestDatabaseTiming,
  measureRequestDatabaseCall,
} from './request-database-timing.js';

describe('request database timing', () => {
  it('isolates overlapping asynchronous requests and excludes unscoped operations', async () => {
    const a = createRequestDatabaseTiming();
    const b = createRequestDatabaseTiming();
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = a.run(() =>
      measureRequestDatabaseCall(async () => {
        await wait;
        return 'a';
      }),
    );
    await b.run(async () => {
      await measureRequestDatabaseCall(async () => 'b');
      await measureRequestDatabaseCall(async () => 'b2');
    });
    await measureRequestDatabaseCall(async () => 'outside');
    release();
    expect(await pending).toBe('a');
    expect(a.finish()).toMatchObject({
      databaseCallsStarted: 1,
      databaseCallsCompleted: 1,
      databaseCallsFailed: 0,
    });
    expect(b.finish()).toMatchObject({
      databaseCallsStarted: 2,
      databaseCallsCompleted: 2,
      databaseCallsFailed: 0,
    });
  });

  it('preserves exact result/error and reports only bounded-shape numeric timing metadata', async () => {
    const scope = createRequestDatabaseTiming();
    const error = new Error('SECRET SQL and params');
    const value = { private: 'SECRET result' };
    await scope.run(async () => {
      expect(await measureRequestDatabaseCall(async () => value)).toBe(value);
      await expect(
        measureRequestDatabaseCall(async () => {
          throw error;
        }),
      ).rejects.toBe(error);
    });
    const report = scope.finish();
    expect(report).toMatchObject({
      databaseCallsStarted: 2,
      databaseCallsCompleted: 2,
      databaseCallsFailed: 1,
    });
    expect(report.databaseCallTotalMs).toBeGreaterThanOrEqual(report.databaseCallMaxMs);
    expect(Object.values(report).every((n) => Number.isFinite(n) && n >= 0)).toBe(true);
    expect(JSON.stringify(report)).not.toContain('SECRET');
  });

  it('does not mutate finished request evidence when outstanding or detached work settles', async () => {
    const scope = createRequestDatabaseTiming();
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = scope.run(async () => {
      await measureRequestDatabaseCall(() => wait);
      await measureRequestDatabaseCall(async () => undefined);
    });
    const report = scope.finish();
    expect(report).toMatchObject({
      databaseCallsStarted: 1,
      databaseCallsCompleted: 0,
      databaseCallsFailed: 0,
    });
    release();
    await pending;
    expect(scope.finish()).toEqual(report);
  });
});
