import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { API_PERFORMANCE_ROUTES } from './api-performance-baseline.mjs';

const SOURCES = ['http', 'sql', 'explain'];
const ALLOWED_ROUTES = new Map(API_PERFORMANCE_ROUTES.map(({ name, path }) => [name, path]));
const CONTEXT_KEYS = ['fixtureKey', 'environmentKey', 'dbSchemaKey', 'actorKey', 'runtimeKey'];
const SAFE_LABEL = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/;
const SHA = /^[a-f0-9]{40}$/i;

class ComparisonValidationError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new ComparisonValidationError(message);
}

function object(value, name) {
  requireValue(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    `Invalid ${name}`,
  );
  return value;
}

function finiteNumber(value, name) {
  requireValue(
    typeof value === 'number' && Number.isFinite(value) && value >= 0,
    `Invalid ${name}`,
  );
  return value;
}

function wholeNumber(value, name) {
  finiteNumber(value, name);
  requireValue(Number.isSafeInteger(value), `Invalid ${name}`);
  return value;
}

function checkContext(context, name) {
  object(context, `${name}.context`);
  requireValue(
    typeof context.commit === 'string' && SHA.test(context.commit),
    `Invalid ${name}.context.commit`,
  );
  for (const key of CONTEXT_KEYS) {
    requireValue(
      typeof context[key] === 'string' && SAFE_LABEL.test(context[key]),
      `Invalid ${name}.context.${key}`,
    );
  }
  requireValue(
    Number.isInteger(context.postgresMajor) &&
      context.postgresMajor >= 12 &&
      context.postgresMajor <= 25,
    `Invalid ${name}.context.postgresMajor`,
  );
}

function validatePair(beforeCapture, afterCapture, source) {
  const before = object(beforeCapture, `before.sources.${source}`);
  const after = object(afterCapture, `after.sources.${source}`);
  checkContext(before.context, `before.sources.${source}`);
  checkContext(after.context, `after.sources.${source}`);
  for (const key of [...CONTEXT_KEYS, 'postgresMajor']) {
    requireValue(
      before.context[key] === after.context[key],
      `Incompatible ${source} context: ${key}`,
    );
  }
  const left = object(before.report, `before.sources.${source}.report`);
  const right = object(after.report, `after.sources.${source}.report`);
  requireValue(
    left.schemaVersion === 1 && right.schemaVersion === 1,
    `Unsupported ${source} report schema`,
  );
  return { before, after, left, right };
}

function resultsByRoute(report, source) {
  const entries = source === 'explain' ? report.plans : report.results;
  requireValue(
    Array.isArray(entries) && entries.length > 0 && entries.length <= ALLOWED_ROUTES.size,
    `Invalid ${source} route results`,
  );
  const map = new Map();
  for (const entry of entries) {
    object(entry, `${source} route entry`);
    requireValue(
      ALLOWED_ROUTES.has(entry.route) && !map.has(entry.route),
      `Invalid or repeated ${source} route`,
    );
    map.set(entry.route, entry);
  }
  return map;
}

function sameRoutes(before, after, source) {
  requireValue(before.size === after.size, `Incompatible ${source} route list`);
  for (const key of before.keys()) {
    requireValue(after.has(key), `Incompatible ${source} route list`);
  }
}

function sameNumber(a, b, field, source) {
  const left = wholeNumber(a, `${source}.${field}`);
  const right = wholeNumber(b, `${source}.${field}`);
  requireValue(left === right, `Incompatible ${source} capture: ${field}`);
}

/** Shared arithmetic for validated, nonnegative finite measurements. */
export function calculatePerformanceDelta(before, after) {
  const delta = Number((after - before).toFixed(3));
  // A zero baseline has no mathematically meaningful percentage change.
  const percentDelta = before === 0 ? null : Number((((after - before) / before) * 100).toFixed(2));
  return { delta, percentDelta };
}

function measureChange(route, metric, beforeValue, afterValue) {
  const oldValue = finiteNumber(beforeValue, `${route}.${metric}.before`);
  const newValue = finiteNumber(afterValue, `${route}.${metric}.after`);
  const change = calculatePerformanceDelta(oldValue, newValue);
  requireValue(
    Number.isFinite(change.delta) &&
      (change.percentDelta === null || Number.isFinite(change.percentDelta)),
    'Non-finite comparison delta or percentage',
  );
  return { route, metric, before: oldValue, after: newValue, ...change };
}

function metricGroup(item, name, source, validate = finiteNumber) {
  const group = object(item[name], `${source}.${name}`);
  for (const metric of ['min', 'p50', 'p95', 'max'])
    validate(group[metric], `${source}.${name}.${metric}`);
  requireValue(
    group.min <= group.p50 && group.p50 <= group.p95 && group.p95 <= group.max,
    `Inconsistent ${source}.${name} percentiles`,
  );
  return group;
}

function compareHttp(left, right) {
  const methodologyA = object(left.methodology, 'http.methodology');
  const methodologyB = object(right.methodology, 'http.methodology');
  const keys = ['concurrency', 'warmupPerRoute', 'samplesPerRoute', 'pauseMs', 'latency', 'bytes'];
  for (const key of keys) {
    requireValue(
      methodologyA[key] !== undefined && methodologyA[key] === methodologyB[key],
      `Incompatible http methodology: ${key}`,
    );
  }
  requireValue(
    typeof left.nodeVersion === 'string' &&
      left.nodeVersion.length > 0 &&
      left.nodeVersion === right.nodeVersion,
    'Incompatible http Node versions',
  );
  sameNumber(methodologyA.samplesPerRoute, methodologyB.samplesPerRoute, 'samplesPerRoute', 'http');
  sameNumber(methodologyA.warmupPerRoute, methodologyB.warmupPerRoute, 'warmupPerRoute', 'http');
  sameNumber(methodologyA.concurrency, methodologyB.concurrency, 'concurrency', 'http');
  sameNumber(methodologyA.pauseMs, methodologyB.pauseMs, 'pauseMs', 'http');

  const before = resultsByRoute(left, 'http');
  const after = resultsByRoute(right, 'http');
  sameRoutes(before, after, 'http');
  const metrics = [];
  for (const [route, a] of before) {
    const b = after.get(route);
    requireValue(
      a.method === 'GET' &&
        b.method === 'GET' &&
        a.path === ALLOWED_ROUTES.get(route) &&
        b.path === a.path,
      `Incompatible http route shape: ${route}`,
    );
    sameNumber(a.samples, b.samples, `${route}.samples`, 'http');
    requireValue(
      a.samples > 0 && a.samples === methodologyA.samplesPerRoute,
      'HTTP sample count differs from methodology',
    );
    const latA = metricGroup(a, 'latencyMs', 'http');
    const latB = metricGroup(b, 'latencyMs', 'http');
    const bytesA = metricGroup(a, 'decodedResponseBytes', 'http', wholeNumber);
    const bytesB = metricGroup(b, 'decodedResponseBytes', 'http', wholeNumber);
    for (const [metric, first, second] of [
      ['latency-p50-ms', latA.p50, latB.p50],
      ['latency-p95-ms', latA.p95, latB.p95],
      ['decoded-bytes-p50', bytesA.p50, bytesB.p50],
      ['decoded-bytes-p95', bytesA.p95, bytesB.p95],
    ]) {
      metrics.push(measureChange(route, metric, first, second));
    }
  }
  return metrics;
}

function compareSql(left, right) {
  requireValue(
    left.method === right.method &&
      left.method === 'test-scoped Prisma query events; serial HTTP requests',
    'Incompatible SQL counting method',
  );
  sameNumber(left.warmups, right.warmups, 'warmups', 'sql');
  const before = resultsByRoute(left, 'sql');
  const after = resultsByRoute(right, 'sql');
  sameRoutes(before, after, 'sql');
  const metrics = [];
  for (const [route, a] of before) {
    const b = after.get(route);
    sameNumber(a.samples, b.samples, `${route}.samples`, 'sql');
    requireValue(a.samples > 0, 'SQL reports must include recorded samples');
    const queryA = metricGroup(a, 'queryCount', 'sql', wholeNumber);
    const queryB = metricGroup(b, 'queryCount', 'sql', wholeNumber);
    for (const [metric, first, second] of [
      ['queries-p50', queryA.p50, queryB.p50],
      ['queries-p95', queryA.p95, queryB.p95],
    ])
      metrics.push(measureChange(route, metric, first, second));
  }
  return metrics;
}

function summarizePlan(entry, side, route) {
  const plan = object(entry.plan, `${side}.${route}.plan`);
  const root = object(plan.root, `${side}.${route}.plan.root`);
  requireValue(typeof root.nodeType === 'string', `Invalid ${side}.${route}.root.nodeType`);
  const values = {
    executionMs: finiteNumber(plan.executionMs, `${side}.${route}.executionMs`),
    planningMs: finiteNumber(plan.planningMs, `${side}.${route}.planningMs`),
    sharedHitBlocks: wholeNumber(root.sharedHitBlocks, `${side}.${route}.sharedHitBlocks`),
    sharedReadBlocks: wholeNumber(root.sharedReadBlocks, `${side}.${route}.sharedReadBlocks`),
  };
  // Never serialize an arbitrary plan node; raw plans can include SQL conditions.
  return values;
}

function compareExplain(left, right) {
  requireValue(
    left.postgres === right.postgres &&
      left.postgres === 'JSON EXPLAIN ANALYZE BUFFERS; SELECT statements only',
    'Incompatible explain method',
  );
  sameNumber(left.fixtureRowsPerTable, right.fixtureRowsPerTable, 'fixtureRowsPerTable', 'explain');
  requireValue(left.fixtureRowsPerTable > 0, 'EXPLAIN fixture must have populated rows');
  const before = resultsByRoute(left, 'explain');
  const after = resultsByRoute(right, 'explain');
  sameRoutes(before, after, 'explain');
  const metrics = [];
  for (const [route, a] of before) {
    const b = after.get(route);
    sameNumber(a.rows, b.rows, `${route}.rows`, 'explain');
    requireValue(a.rows === left.fixtureRowsPerTable, 'Incompatible EXPLAIN fixture row count');
    const first = summarizePlan(a, 'before', route);
    const second = summarizePlan(b, 'after', route);
    for (const [metric, property] of [
      ['sql-execution-ms', 'executionMs'],
      ['sql-planning-ms', 'planningMs'],
      ['shared-hit-blocks', 'sharedHitBlocks'],
      ['shared-read-blocks', 'sharedReadBlocks'],
    ])
      metrics.push(measureChange(route, metric, first[property], second[property]));
  }
  return metrics;
}

export function compareApiPerformance(beforeInput, afterInput) {
  const before = object(beforeInput, 'before bundle');
  const after = object(afterInput, 'after bundle');
  requireValue(
    before.schemaVersion === 1 && after.schemaVersion === 1,
    'Unsupported comparison bundle schema',
  );
  const beforeSources = object(before.sources, 'before.sources');
  const afterSources = object(after.sources, 'after.sources');
  const present = SOURCES.filter((source) => beforeSources[source] !== undefined);
  requireValue(present.length > 0, 'At least one performance source is required');
  for (const source of SOURCES) {
    requireValue(
      (beforeSources[source] === undefined) === (afterSources[source] === undefined),
      `Missing corresponding ${source} capture`,
    );
  }
  requireValue(
    Object.keys(beforeSources).every((key) => SOURCES.includes(key)) &&
      Object.keys(afterSources).every((key) => SOURCES.includes(key)),
    'Unknown performance source',
  );
  const comparisons = present.map((source) => {
    const {
      before: beforeCapture,
      after: afterCapture,
      left,
      right,
    } = validatePair(beforeSources[source], afterSources[source], source);
    const metrics =
      source === 'http'
        ? compareHttp(left, right)
        : source === 'sql'
          ? compareSql(left, right)
          : compareExplain(left, right);
    return {
      source,
      beforeCommit: beforeCapture.context.commit,
      afterCommit: afterCapture.context.commit,
      metrics,
    };
  });
  return {
    schemaVersion: 1,
    note: 'Exploratory deltas only. Negative delta is lower; statistical significance not assessed.',
    comparisons,
  };
}

async function main() {
  if (process.argv.length !== 4) {
    throw new ComparisonValidationError(
      'Usage: pnpm perf:api:compare <before-bundle.json> <after-bundle.json>',
    );
  }
  const [before, after] = await Promise.all([
    readFile(process.argv[2], 'utf8').then(JSON.parse),
    readFile(process.argv[3], 'utf8').then(JSON.parse),
  ]);
  process.stdout.write(JSON.stringify(compareApiPerformance(before, after), null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    // Do not echo input JSON, paths or secret-bearing payloads on failure.
    process.stderr.write(
      'API performance comparison failed: ' +
        (error instanceof ComparisonValidationError ? error.message : 'invalid input or file') +
        '\n',
    );
    process.exitCode = 1;
  }
}
