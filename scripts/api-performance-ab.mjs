import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { compareApiPerformance } from './api-performance-compare.mjs';

const SHA = /^[0-9a-f]{40}$/i;
const FINGERPRINT = /^[0-9a-f]{64}$/i;
const FIXTURE_RECIPE = 'http-reads-populated-v1-128';
const COMPATIBILITY_PATHS = Object.freeze([
  'apps/api/test/e2e/infra/performance-query-count.e2e-spec.ts',
  'apps/api/vitest.config.e2e.ts',
  'apps/api/prisma/schemas',
  'apps/api/prisma/migrations',
  'apps/api/prisma7.config.ts',
  'apps/api/package.json',
  'pnpm-lock.yaml',
]);

class ABValidationError extends Error {}

function requireValid(condition, message) {
  if (!condition) throw new ABValidationError(message);
}

function record(value, label) {
  requireValid(value && typeof value === 'object' && !Array.isArray(value), 'Invalid ' + label);
  return value;
}

function finite(value, label) {
  requireValid(
    typeof value === 'number' && Number.isFinite(value) && value >= 0,
    'Invalid ' + label,
  );
  return value;
}

function integer(value, label) {
  finite(value, label);
  requireValid(Number.isSafeInteger(value), 'Invalid ' + label);
  return value;
}

function percentileValues(group, label) {
  record(group, label);
  const result = Object.fromEntries(
    ['min', 'p50', 'p95', 'max'].map((key) => [key, finite(group[key], label + '.' + key)]),
  );
  requireValid(
    result.min <= result.p50 && result.p50 <= result.p95 && result.p95 <= result.max,
    'Invalid ' + label + ' percentiles',
  );
  return result;
}

function gitValue(dir, ...args) {
  try {
    return execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    throw new ABValidationError('Unable to verify pinned Git revision or compatibility tree');
  }
}

export function preflightAB(beforeDirectory, afterDirectory, beforeSha, afterSha) {
  requireValid(
    SHA.test(beforeSha) && SHA.test(afterSha),
    'Both revisions require full 40-character Git SHAs',
  );
  requireValid(
    gitValue(beforeDirectory, 'rev-parse', 'HEAD') === beforeSha,
    'Before checkout does not match the pinned SHA',
  );
  requireValid(
    gitValue(afterDirectory, 'rev-parse', 'HEAD') === afterSha,
    'After checkout does not match the pinned SHA',
  );

  const treeEntries = COMPATIBILITY_PATHS.map((path) => {
    const before = gitValue(beforeDirectory, 'rev-parse', 'HEAD:' + path);
    const after = gitValue(afterDirectory, 'rev-parse', 'HEAD:' + path);
    requireValid(
      before === after,
      'A/B requires identical fixture, migration schema and locked dependencies',
    );
    return path + ':' + before;
  });

  return {
    schemaVersion: 1,
    beforeCommit: beforeSha,
    afterCommit: afterSha,
    dbSchemaKey: createHash('sha256').update(treeEntries.join('\n')).digest('hex'),
    method: 'two isolated PostgreSQL 17 test DBs on one runner, identical pinned fixture code',
  };
}

function sanitizeHttp(report) {
  record(report, 'HTTP profile');
  record(report.methodology, 'HTTP methodology');
  requireValid(
    report.schemaVersion === 1 && /^v24\.\d+\.\d+$/.test(report.nodeVersion),
    'Unsupported HTTP report or Node version',
  );
  requireValid(Number.isFinite(Date.parse(report.capturedAt)), 'Invalid HTTP capture time');
  const m = report.methodology;
  requireValid(
    m.concurrency === 1 && m.warmupPerRoute === 2 && m.samplesPerRoute === 25 && m.pauseMs === 0,
    'Unexpected HTTP measurement settings',
  );
  requireValid(
    m.latency === 'elapsed time through complete response body read' &&
      m.bytes === 'decoded response body size, not network transfer bytes',
    'Unexpected HTTP measurement method',
  );
  requireValid(
    Array.isArray(report.results) && report.results.length === 4,
    'Incomplete HTTP routes',
  );
  return {
    schemaVersion: 1,
    capturedAt: new Date(report.capturedAt).toISOString(),
    nodeVersion: report.nodeVersion,
    methodology: {
      concurrency: 1,
      warmupPerRoute: 2,
      samplesPerRoute: 25,
      pauseMs: 0,
      latency: m.latency,
      bytes: m.bytes,
    },
    results: report.results.map((value) => {
      record(value, 'HTTP route');
      requireValid(value.method === 'GET' && value.samples === 25, 'Invalid HTTP route samples');
      if (value.route === 'exercises') {
        requireValid(
          typeof value.responseSha256 === 'string' && FINGERPRINT.test(value.responseSha256),
          'Missing Exercises HTTP response fingerprint',
        );
      } else {
        requireValid(value.responseSha256 === undefined, 'Unexpected HTTP response fingerprint');
      }
      return {
        route: value.route,
        path: value.path,
        method: 'GET',
        samples: 25,
        latencyMs: percentileValues(value.latencyMs, 'HTTP latency'),
        decodedResponseBytes: percentileValues(value.decodedResponseBytes, 'HTTP response bytes'),
        ...(value.route === 'exercises' ? { responseSha256: value.responseSha256 } : {}),
      };
    }),
  };
}

function sanitizeSql(report) {
  record(report, 'SQL profile');
  requireValid(
    report.schemaVersion === 1 &&
      report.warmups === 2 &&
      report.method === 'test-scoped Prisma query events; serial HTTP requests',
    'Unexpected SQL measurement method',
  );
  requireValid(
    Array.isArray(report.results) && report.results.length === 4,
    'Incomplete SQL routes',
  );
  return {
    schemaVersion: 1,
    warmups: 2,
    method: 'test-scoped Prisma query events; serial HTTP requests',
    results: report.results.map((value) => {
      record(value, 'SQL route');
      requireValid(value.samples === 25, 'Invalid SQL route samples');
      const queryCount = percentileValues(value.queryCount, 'SQL query count');
      for (const count of Object.values(queryCount)) integer(count, 'SQL query count');
      return { route: value.route, samples: 25, queryCount };
    }),
  };
}

/** Extract an allowlisted report, never arbitrary test stdout or SQL text. */
export function sanitizeProfile(profile) {
  record(profile, 'profile');
  const fixture = record(profile.fixture, 'fixture');
  requireValid(
    profile.schemaVersion === 1 && fixture.recipe === FIXTURE_RECIPE,
    'Unsupported deterministic fixture recipe',
  );
  requireValid(
    typeof fixture.fingerprint === 'string' && FINGERPRINT.test(fixture.fingerprint),
    'Missing persisted fixture fingerprint',
  );
  for (const [field, count] of Object.entries({
    athleteAccounts: 1,
    trainerAccounts: 1,
    workouts: 128,
    trainingPrograms: 128,
    trainingProgramVersions: 128,
    exercises: 128,
  })) {
    requireValid(fixture[field] === count, 'Unexpected fixture population');
  }
  const sanitized = {
    schemaVersion: 1,
    fixture: {
      recipe: FIXTURE_RECIPE,
      fingerprint: fixture.fingerprint,
      athleteAccounts: 1,
      trainerAccounts: 1,
      workouts: 128,
      trainingPrograms: 128,
      trainingProgramVersions: 128,
      exercises: 128,
    },
    http: sanitizeHttp(profile.http),
    sql: sanitizeSql(profile.sql),
  };
  // Reuse the strict comparator's route/percentile validation on the normalized structure.
  const selfBundle = {
    schemaVersion: 1,
    sources: {
      http: {
        context: testContext('a'.repeat(40), fixture.fingerprint, 'f'.repeat(64)),
        report: sanitized.http,
      },
      sql: {
        context: testContext('a'.repeat(40), fixture.fingerprint, 'f'.repeat(64)),
        report: sanitized.sql,
      },
    },
  };
  try {
    compareApiPerformance(selfBundle, selfBundle);
  } catch {
    throw new ABValidationError('Invalid or incomplete comparison routes');
  }
  return sanitized;
}

function testContext(commit, fingerprint, schemaKey) {
  return {
    commit,
    fixtureKey: fingerprint,
    environmentKey: 'ubuntu2404_node24_pg17_same_runner',
    dbSchemaKey: schemaKey,
    actorKey: 'one_athlete_one_trainer',
    runtimeKey: 'vitest_serial_http_e2e',
    postgresMajor: 17,
  };
}

export function extractProfileFromLog(log) {
  requireValid(
    typeof log === 'string' && log.length <= 12_000_000,
    'Invalid or oversized test log',
  );
  const prefix = 'API_PERF_PROFILE ';
  const matches = log.split(/\r?\n/).filter((line) => line.includes(prefix));
  requireValid(matches.length === 1, 'Expected exactly one populated API profile report');
  const line = matches[0];
  let profile;
  try {
    const raw = line
      .slice(line.indexOf(prefix) + prefix.length)
      .trim()
      .replace(/\x1b\[[0-9;]*m$/, '');
    profile = JSON.parse(raw);
  } catch {
    throw new ABValidationError('Invalid profile JSON');
  }
  return sanitizeProfile(profile);
}

export function compareAB(manifestInput, beforeInput, afterInput) {
  const manifest = record(manifestInput, 'A/B manifest');
  requireValid(
    manifest.schemaVersion === 1 &&
      SHA.test(manifest.beforeCommit) &&
      SHA.test(manifest.afterCommit) &&
      FINGERPRINT.test(manifest.dbSchemaKey),
    'Invalid pinned A/B manifest',
  );
  const before = sanitizeProfile(beforeInput);
  const after = sanitizeProfile(afterInput);
  requireValid(
    before.fixture.fingerprint === after.fixture.fingerprint,
    'Persisted fixture fingerprints differ: refusing invalid A/B comparison',
  );
  requireValid(before.fixture.recipe === after.fixture.recipe, 'A/B fixture recipes differ');
  const beforeExercises = before.http.results.find((route) => route.route === 'exercises');
  const afterExercises = after.http.results.find((route) => route.route === 'exercises');
  requireValid(
    beforeExercises?.responseSha256 === afterExercises?.responseSha256,
    'Exercises HTTP response fingerprints differ: refusing unsafe A/B comparison',
  );

  const bundle = (commit, report) => ({
    schemaVersion: 1,
    sources: {
      http: {
        context: testContext(commit, report.fixture.fingerprint, manifest.dbSchemaKey),
        report: report.http,
      },
      sql: {
        context: testContext(commit, report.fixture.fingerprint, manifest.dbSchemaKey),
        report: report.sql,
      },
    },
  });
  let comparison;
  try {
    comparison = compareApiPerformance(
      bundle(manifest.beforeCommit, before),
      bundle(manifest.afterCommit, after),
    );
  } catch {
    throw new ABValidationError('Incompatible A/B route, methodology or sample data');
  }
  return {
    schemaVersion: 1,
    mode:
      manifest.beforeCommit === manifest.afterCommit
        ? 'A/A pipeline smoke (no code change)'
        : 'A/B exploratory comparison',
    fixtureFingerprint: before.fixture.fingerprint,
    responseEquivalence: { exercises: 'identical-serialized-json' },
    ...comparison,
  };
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'preflight' && args.length === 5) {
    const manifest = preflightAB(args[0], args[1], args[2], args[3]);
    await writeFile(args[4], JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  } else if (mode === 'extract' && args.length === 2) {
    const log = await readFile(args[0], 'utf8');
    const sanitized = extractProfileFromLog(log);
    await writeFile(args[1], JSON.stringify(sanitized, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
  } else if (mode === 'compare' && args.length === 4) {
    const [manifest, before, after] = await Promise.all(
      args.slice(0, 3).map((path) => readFile(path, 'utf8').then(JSON.parse)),
    );
    const result = compareAB(manifest, before, after);
    const runId = process.env.GITHUB_RUN_ID;
    const attempt = process.env.GITHUB_RUN_ATTEMPT;
    if (runId !== undefined || attempt !== undefined) {
      // Immutable metadata from the Actions runner allows a later read-only
      // summary to reject copied artifacts masquerading as independent trials.
      if (
        !/^[1-9][0-9]{0,18}$/.test(runId ?? '') ||
        !/^[1-9][0-9]{0,4}$/.test(attempt ?? '') ||
        !Number.isSafeInteger(Number(attempt))
      ) {
        throw new ABValidationError('Invalid GitHub Actions run provenance');
      }
      result.run = { githubRunId: runId, githubAttempt: Number(attempt) };
    }
    await writeFile(args[3], JSON.stringify(result, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
  } else {
    throw new ABValidationError(
      'Usage: api-performance-ab.mjs preflight|extract|compare (see API A/B runbook)',
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    // Keep filesystem paths, input JSON, and any log contents out of error messages.
    process.stderr.write(
      'API performance A/B failed: ' +
        (error instanceof ABValidationError ? error.message : 'invalid input or file') +
        '\n',
    );
    process.exitCode = 1;
  }
}
