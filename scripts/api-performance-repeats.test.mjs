import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

import { summarizeRepeatedAB } from './api-performance-repeats.mjs';

const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const FINGERPRINT = 'f'.repeat(64);
const ROUTES = ['users-me', 'workouts-summary', 'training-programs', 'exercises'];
const HTTP_METRICS = ['latency-p50-ms', 'latency-p95-ms', 'decoded-bytes-p50', 'decoded-bytes-p95'];
const SQL_METRICS = ['queries-p50', 'queries-p95'];

function measure(route, metric, before, after) {
  const delta = Number((after - before).toFixed(3));
  return {
    route,
    metric,
    before,
    after,
    delta,
    percentDelta: before === 0 ? null : Number((((after - before) / before) * 100).toFixed(2)),
  };
}

function capture(attempt, { p95 = 9, p50 = 6, queries = 6, bytes = 7325 } = {}) {
  const metrics = (source) =>
    ROUTES.flatMap((route) =>
      (source === 'http' ? HTTP_METRICS : SQL_METRICS).map((metric) => {
        if (metric === 'latency-p95-ms') return measure(route, metric, 10, p95);
        if (metric === 'latency-p50-ms') return measure(route, metric, 7, p50);
        if (metric.startsWith('decoded-bytes-')) return measure(route, metric, bytes, bytes);
        return measure(route, metric, 7, queries);
      }),
    );
  return {
    schemaVersion: 1,
    mode: 'A/B exploratory comparison',
    fixtureFingerprint: FINGERPRINT,
    run: { githubRunId: '44943009699', githubAttempt: attempt },
    comparisons: ['http', 'sql'].map((source) => ({
      source,
      beforeCommit: BASE,
      afterCommit: HEAD,
      metrics: metrics(source),
    })),
    privateData: { sql: 'SELECT * FROM SECRET', accessToken: 'not-allowed' },
  };
}

const trio = () => [capture(1, { p95: 9.5 }), capture(2, { p95: 12 }), capture(3, { p95: 11 })];

describe('Repeated API performance A/B report', () => {
  it('summarizes three independently identified reports with mixed p95 results', () => {
    const result = summarizeRepeatedAB(trio());
    assert.equal(result.mode, 'Repeated A/B exploratory summary');
    assert.equal(result.repetitions, 3);
    assert.equal(result.beforeCommit, BASE);
    assert.equal(result.afterCommit, HEAD);
    assert.equal(result.runAttempts[0], '44943009699:1');
    assert.equal(result.runAttempts[2], '44943009699:3');
    assert.deepEqual(
      result.routes.map((route) => route.route),
      ROUTES,
    );
    assert.equal(result.routes[0].latencyP95.beforeMedian, 10);
    assert.equal(result.routes[0].latencyP95.afterMedian, 11);
    assert.equal(result.routes[0].latencyP95.medianPercentDelta, 10);
    assert.equal(result.routes[0].latencyP95.minPercentDelta, -5);
    assert.equal(result.routes[0].latencyP95.maxPercentDelta, 20);
    assert.equal(result.routes[0].latencyP95.lowerRuns, 1);
    assert.equal(result.routes[0].latencyP95.higherRuns, 2);
    assert.equal(result.routes[0].latencyP95.direction, 'mixed');
    assert.equal(result.routes[0].decodedBytesP95, 7325);
    assert.equal(result.routes[0].queriesP95.direction, 'consistently-lower');
    assert.doesNotMatch(JSON.stringify(result), /SELECT|SECRET|not-allowed|accessToken/);
  });

  it('reports all consistent lower/higher/unchanged directions without calling them improvements', () => {
    const lower = summarizeRepeatedAB([capture(1), capture(2), capture(3)]);
    assert.equal(lower.routes[0].latencyP95.direction, 'consistently-lower');
    assert.equal(lower.routes[0].latencyP95.medianPercentDelta, -10);
    assert.match(lower.note, /not a significance test/i);

    const higher = summarizeRepeatedAB([
      capture(1, { p95: 11 }),
      capture(2, { p95: 12 }),
      capture(3, { p95: 13 }),
    ]);
    assert.equal(higher.routes[0].latencyP95.direction, 'consistently-higher');

    const same = summarizeRepeatedAB([
      capture(1, { p95: 10, p50: 7, queries: 7 }),
      capture(2, { p95: 10, p50: 7, queries: 7 }),
      capture(3, { p95: 10, p50: 7, queries: 7 }),
    ]);
    assert.equal(same.routes[0].latencyP95.direction, 'unchanged');
    assert.equal(same.routes[0].queriesP95.direction, 'unchanged');
  });

  it('requires three through twelve *independent* recorded GitHub Actions attempts', () => {
    assert.throws(() => summarizeRepeatedAB([capture(1), capture(2)]), /between 3 and 12/);
    assert.throws(
      () => summarizeRepeatedAB(Array.from({ length: 13 }, (_, i) => capture(i + 1))),
      /between 3 and 12/,
    );
    const copies = [capture(1), capture(1), capture(2)];
    assert.throws(() => summarizeRepeatedAB(copies), /Duplicate GitHub Actions run attempt/);

    const noRun = trio();
    delete noRun[1].run;
    assert.throws(() => summarizeRepeatedAB(noRun), /GitHub Actions attempt/);
    const invalidRun = trio();
    invalidRun[1].run.githubRunId = 'abc/../not-safe';
    assert.throws(() => summarizeRepeatedAB(invalidRun), /run provenance/);
    const noAttempt = trio();
    noAttempt[1].run.githubAttempt = 0;
    assert.throws(() => summarizeRepeatedAB(noAttempt), /run provenance/);
  });

  it('rejects A/A smoke and different pinned commit pairs or persisted fixture hashes', () => {
    const aa = trio();
    aa[1].mode = 'A/A pipeline smoke (no code change)';
    assert.throws(() => summarizeRepeatedAB(aa), /genuine A\/B reports/);

    const mismatch = trio();
    mismatch[2].comparisons[0].afterCommit = 'c'.repeat(40);
    assert.throws(() => summarizeRepeatedAB(mismatch), /same pinned commit pair/);

    const differentSha = trio();
    differentSha[2].comparisons.forEach((item) => (item.afterCommit = 'c'.repeat(40)));
    assert.throws(() => summarizeRepeatedAB(differentSha), /different pinned Git revisions/);

    const fixture = trio();
    fixture[1].fixtureFingerprint = 'e'.repeat(64);
    assert.throws(() => summarizeRepeatedAB(fixture), /fixture fingerprints/);
  });

  it('rejects non-string provenance and case-only commit differences', () => {
    const invalidHash = trio();
    invalidHash[0].fixtureFingerprint = [FINGERPRINT];
    assert.throws(() => summarizeRepeatedAB(invalidHash), /fixture fingerprint/);

    const invalidCommit = trio();
    invalidCommit[0].comparisons[0].beforeCommit = [BASE];
    assert.throws(() => summarizeRepeatedAB(invalidCommit), /Invalid or identical compared commits/);

    const sameCommit = trio();
    sameCommit.forEach((report) =>
      report.comparisons.forEach((source) => {
        source.afterCommit = BASE.toUpperCase();
      }),
    );
    assert.throws(() => summarizeRepeatedAB(sameCommit), /Invalid or identical compared commits/);
  });

  it('rejects overflowing percentage claims and keeps large finite medians representable', () => {
    const invalid = trio();
    invalid[0].comparisons[0].metrics[0] = measure('users-me', 'latency-p50-ms', 1e-300, 1e100);
    assert.throws(() => summarizeRepeatedAB(invalid), /Inconsistent comparison percentage/);

    const large = [capture(1), capture(2), capture(3), capture(4)];
    for (const report of large) {
      report.comparisons[0].metrics[0] = measure('users-me', 'latency-p50-ms', 1e308, 1e308);
    }
    const result = summarizeRepeatedAB(large);
    assert.equal(result.routes[0].latencyP50.beforeMedian, 1e308);
    assert.equal(result.routes[0].latencyP50.afterMedian, 1e308);
  });

  it('rejects altered bytes within and across runs, without revealing user data', () => {
    const altered = trio();
    const item = altered[1].comparisons[0].metrics.find((m) => m.metric === 'decoded-bytes-p95');
    item.after = 7324;
    item.delta = -1;
    item.percentDelta = Number((-100 / 7325).toFixed(2));
    assert.throws(() => summarizeRepeatedAB(altered), /Decoded response bytes changed/);

    const inconsistent = trio();
    const item2 = inconsistent[2].comparisons[0].metrics.filter((m) =>
      m.metric.startsWith('decoded-bytes-'),
    );
    item2.forEach((m) => {
      m.before += 4;
      m.after += 4;
    });
    assert.throws(() => summarizeRepeatedAB(inconsistent), /between A\/B repetitions/);

    const negative = trio();
    negative[1].comparisons[0].metrics[0].after = -1;
    assert.throws(() => summarizeRepeatedAB(negative), /Invalid after measurement/);
  });

  it('rejects missing, duplicate, unknown routes/sources/metrics and misleading numeric deltas', () => {
    const missing = trio();
    missing[1].comparisons[0].metrics.pop();
    assert.throws(() => summarizeRepeatedAB(missing), /Incomplete comparison metrics/);

    const repeated = trio();
    repeated[1].comparisons[0].metrics[0] = repeated[1].comparisons[0].metrics[1];
    assert.throws(() => summarizeRepeatedAB(repeated), /Duplicate comparison route or metric/);

    const unapproved = trio();
    unapproved[1].comparisons[0].metrics[0].route = 'admin-users';
    assert.throws(() => summarizeRepeatedAB(unapproved), /Unknown comparison route or metric/);

    const source = trio();
    source[1].comparisons[0].source = 'explain';
    assert.throws(() => summarizeRepeatedAB(source), /Unknown or repeated comparison source/);

    const badDelta = trio();
    badDelta[1].comparisons[0].metrics[0].delta = -100;
    assert.throws(() => summarizeRepeatedAB(badDelta), /Inconsistent comparison delta/);

    const badPct = trio();
    badPct[1].comparisons[0].metrics[0].percentDelta = -100;
    assert.throws(() => summarizeRepeatedAB(badPct), /Inconsistent comparison percentage/);

    const sqlFraction = trio();
    sqlFraction[1].comparisons[1].metrics[0] = measure('users-me', 'queries-p50', 7, 5.5);
    assert.throws(() => summarizeRepeatedAB(sqlFraction), /Invalid Prisma query count/);
  });

  it('does not allow zero-baseline percent claims or a truncated source report', () => {
    const zero = trio();
    zero.forEach((report) => {
      const entry = report.comparisons[0].metrics.find((m) => m.metric === 'latency-p95-ms');
      entry.before = 0;
      entry.delta = entry.after;
      entry.percentDelta = null;
    });
    const result = summarizeRepeatedAB(zero);
    assert.equal(result.routes[0].latencyP95.medianPercentDelta, null);
    assert.equal(result.routes[0].latencyP95.direction, 'mixed');

    const noSql = trio();
    noSql[1].comparisons.pop();
    assert.throws(() => summarizeRepeatedAB(noSql), /both HTTP and SQL sources/);
  });

  it('CLI returns allowlisted numeric summary; errors never expose file paths or input data', () => {
    const directory = mkdtempSync(join(tmpdir(), 'api-perf-repeats-'));
    const script = fileURLToPath(new URL('./api-performance-repeats.mjs', import.meta.url));
    try {
      const paths = trio().map((report, index) => {
        const path = join(directory, 'secret-payload-' + index + '.json');
        writeFileSync(path, JSON.stringify(report));
        return path;
      });
      const success = spawnSync(process.execPath, [script, ...paths], { encoding: 'utf8' });
      assert.equal(success.status, 0, success.stderr);
      const parsed = JSON.parse(success.stdout);
      assert.equal(parsed.repetitions, 3);
      assert.equal(parsed.routes[0].latencyP95.direction, 'mixed');
      assert.doesNotMatch(success.stdout, /SECRET|SELECT|secret-payload|not-allowed/);

      writeFileSync(paths[1], '{"password":"secret123"}');
      const error = spawnSync(process.execPath, [script, ...paths], { encoding: 'utf8' });
      assert.equal(error.status, 1);
      assert.match(error.stderr, /API repeated A\/B failed/);
      assert.doesNotMatch(error.stderr, /password|secret123|secret-payload|SELECT/);
      assert.equal(error.stdout, '');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
