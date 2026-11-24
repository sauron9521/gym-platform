import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { API_PERFORMANCE_ROUTES } from './api-performance-baseline.mjs';
import { calculatePerformanceDelta } from './api-performance-compare.mjs';

const SHA = /^[a-f0-9]{40}$/i;
const FINGERPRINT = /^[a-f0-9]{64}$/i;
const RUN_ID = /^[1-9][0-9]{0,18}$/;
const METRICS = {
  http: ['latency-p50-ms', 'latency-p95-ms', 'decoded-bytes-p50', 'decoded-bytes-p95'],
  sql: ['queries-p50', 'queries-p95'],
};
const ROUTES = API_PERFORMANCE_ROUTES.map(({ name }) => name);
const MAX_RUNS = 12;

class RepeatabilityError extends Error {}

function check(condition, description) {
  if (!condition) throw new RepeatabilityError(description);
}

function object(value, description) {
  check(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'Invalid ' + description,
  );
  return value;
}

function finite(value, description) {
  check(
    typeof value === 'number' && Number.isFinite(value) && value >= 0,
    'Invalid ' + description,
  );
  return value;
}

function count(value, description) {
  finite(value, description);
  check(Number.isSafeInteger(value), 'Invalid ' + description);
  return value;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : sorted[mid - 1] / 2 + sorted[mid] / 2;
}

function round(value, places = 3) {
  return Number(value.toFixed(places));
}

function normalizeReport(report) {
  object(report, 'comparison report');
  check(
    report.schemaVersion === 1 && report.mode === 'A/B exploratory comparison',
    'Repeated analysis requires genuine A/B reports, not A/A smoke',
  );
  check(
    typeof report.fixtureFingerprint === 'string' && FINGERPRINT.test(report.fixtureFingerprint),
    'Missing persisted fixture fingerprint',
  );
  const run = object(report.run, 'independent GitHub Actions attempt');
  check(
    typeof run.githubRunId === 'string' &&
      RUN_ID.test(run.githubRunId) &&
      Number.isSafeInteger(run.githubAttempt) &&
      run.githubAttempt >= 1 &&
      run.githubAttempt <= 10000,
    'Missing or invalid GitHub Actions run provenance',
  );
  check(
    Array.isArray(report.comparisons) && report.comparisons.length === 2,
    'Repeated analysis requires both HTTP and SQL sources',
  );

  const metrics = new Map();
  let beforeCommit;
  let afterCommit;

  for (const sourceReport of report.comparisons) {
    object(sourceReport, 'comparison source');
    const { source } = sourceReport;
    check(
      Object.hasOwn(METRICS, source) && !metrics.has(source),
      'Unknown or repeated comparison source',
    );
    check(
      typeof sourceReport.beforeCommit === 'string' &&
        typeof sourceReport.afterCommit === 'string' &&
        SHA.test(sourceReport.beforeCommit) &&
        SHA.test(sourceReport.afterCommit) &&
        sourceReport.beforeCommit.toLowerCase() !== sourceReport.afterCommit.toLowerCase(),
      'Invalid or identical compared commits',
    );

    beforeCommit ??= sourceReport.beforeCommit;
    afterCommit ??= sourceReport.afterCommit;
    check(
      beforeCommit === sourceReport.beforeCommit && afterCommit === sourceReport.afterCommit,
      'Sources must use the same pinned commit pair',
    );

    const entries = sourceReport.metrics;
    check(
      Array.isArray(entries) && entries.length === ROUTES.length * METRICS[source].length,
      'Incomplete comparison metrics',
    );
    const byRoute = new Map();

    for (const entry of entries) {
      object(entry, 'comparison metric');
      check(
        ROUTES.includes(entry.route) && METRICS[source].includes(entry.metric),
        'Unknown comparison route or metric',
      );
      const key = entry.route + ':' + entry.metric;
      check(!byRoute.has(key), 'Duplicate comparison route or metric');

      const before = finite(entry.before, 'before measurement');
      const after = finite(entry.after, 'after measurement');
      const delta = entry.delta;
      const expected = calculatePerformanceDelta(before, after);
      check(
        typeof delta === 'number' &&
          Number.isFinite(delta) &&
          Number.isFinite(expected.delta) &&
          Math.abs(delta - expected.delta) <= 0.0011,
        'Inconsistent comparison delta',
      );

      const expectedPercent = expected.percentDelta;
      check(
        expectedPercent === null
          ? entry.percentDelta === null
          : Number.isFinite(expectedPercent) &&
              typeof entry.percentDelta === 'number' &&
              Number.isFinite(entry.percentDelta) &&
              Math.abs(entry.percentDelta - expectedPercent) <= 0.011,
        'Inconsistent comparison percentage',
      );

      if (entry.metric.startsWith('decoded-bytes-')) {
        count(before, 'response bytes');
        count(after, 'response bytes');
        check(
          before === after,
          'Decoded response bytes changed: comparison cannot establish equivalence',
        );
      }
      if (entry.metric.startsWith('queries-')) {
        count(before, 'Prisma query count');
        count(after, 'Prisma query count');
      }
      byRoute.set(key, { before, after, percentDelta: entry.percentDelta });
    }
    metrics.set(source, byRoute);
  }

  return {
    id: run.githubRunId + ':' + run.githubAttempt,
    beforeCommit,
    afterCommit,
    fingerprint: report.fixtureFingerprint,
    metrics,
  };
}

function summarize(values) {
  const before = values.map((v) => v.before);
  const after = values.map((v) => v.after);
  const percentages = values.map((v) => v.percentDelta);
  const comparable = percentages.filter((v) => v !== null);
  const lower = comparable.filter((v) => v < 0).length;
  const higher = comparable.filter((v) => v > 0).length;
  const unchanged = comparable.filter((v) => v === 0).length;
  return {
    beforeMedian: round(median(before)),
    afterMedian: round(median(after)),
    medianPercentDelta: comparable.length === values.length ? round(median(comparable), 2) : null,
    minPercentDelta: comparable.length === values.length ? Math.min(...comparable) : null,
    maxPercentDelta: comparable.length === values.length ? Math.max(...comparable) : null,
    lowerRuns: lower,
    higherRuns: higher,
    unchangedRuns: unchanged,
    direction:
      lower === values.length
        ? 'consistently-lower'
        : higher === values.length
          ? 'consistently-higher'
          : unchanged === values.length
            ? 'unchanged'
            : 'mixed',
  };
}

/**
 * Read-only aggregation of 3-12 *independently recorded* A/B attempts.
 * A matching fixture fingerprint and unchanged JSON bytes are necessary,
 * but do not establish statistical significance or production readiness.
 */
export function summarizeRepeatedAB(reports) {
  check(
    Array.isArray(reports) && reports.length >= 3 && reports.length <= MAX_RUNS,
    'Use between 3 and 12 independent A/B comparison reports',
  );
  const normalized = reports.map(normalizeReport);
  const first = normalized[0];

  const unique = new Set();
  for (const run of normalized) {
    check(
      !unique.has(run.id),
      'Duplicate GitHub Actions run attempt: not an independent repetition',
    );
    unique.add(run.id);
    check(
      run.beforeCommit === first.beforeCommit && run.afterCommit === first.afterCommit,
      'Runs compare different pinned Git revisions',
    );
    check(
      run.fingerprint === first.fingerprint,
      'Runs contain different persisted fixture fingerprints',
    );
  }

  const summaries = ROUTES.map((route) => {
    const read = (source, metric) =>
      normalized.map((r) => r.metrics.get(source).get(route + ':' + metric));
    for (const metric of ['decoded-bytes-p50', 'decoded-bytes-p95']) {
      const values = read('http', metric);
      check(
        values.every((v) => v.before === values[0].before && v.after === values[0].after),
        'Decoded response bytes differ between A/B repetitions',
      );
    }
    return {
      route,
      latencyP50: summarize(read('http', 'latency-p50-ms')),
      latencyP95: summarize(read('http', 'latency-p95-ms')),
      queriesP95: summarize(read('sql', 'queries-p95')),
      decodedBytesP95: read('http', 'decoded-bytes-p95')[0].before,
    };
  });

  return {
    schemaVersion: 1,
    mode: 'Repeated A/B exploratory summary',
    beforeCommit: first.beforeCommit,
    afterCommit: first.afterCommit,
    fixtureFingerprint: first.fingerprint,
    repetitions: normalized.length,
    runAttempts: normalized.map((r) => r.id),
    routes: summaries,
    note: 'Directional consistency is not a significance test, SLO gate, or proof of performance improvement. Review p95 noise, SQL plans, and representative data before merging.',
  };
}

async function main() {
  const paths = process.argv.slice(2);
  check(
    paths.length >= 3 && paths.length <= MAX_RUNS,
    'Usage: pnpm perf:api:repeats <3-12 comparison.json paths>',
  );
  const reports = await Promise.all(
    paths.map(async (path) => {
      const content = await readFile(path, 'utf8');
      check(content.length <= 1_000_000, 'Oversized comparison report');
      return JSON.parse(content);
    }),
  );
  process.stdout.write(JSON.stringify(summarizeRepeatedAB(reports), null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    // Do not echo file paths, input JSON, SQL text or credentials.
    process.stderr.write(
      'API repeated A/B failed: ' +
        (error instanceof RepeatabilityError ? error.message : 'invalid report or file') +
        '\n',
    );
    process.exitCode = 1;
  }
}
