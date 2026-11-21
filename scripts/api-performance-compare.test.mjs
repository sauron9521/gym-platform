import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

import { compareApiPerformance } from './api-performance-compare.mjs';

const ROUTES = [
  ['users-me', '/users/me'],
  ['workouts-summary', '/workouts?view=summary&limit=20'],
  ['training-programs', '/training-programs?limit=20'],
  ['exercises', '/exercises?limit=20'],
];

const INITIAL = 'a'.repeat(40);
const UPDATED = 'b'.repeat(40);

const context = (commit) => ({
  commit,
  fixtureKey: 'read-fixture-v1',
  environmentKey: 'linux-node24-test',
  dbSchemaKey: 'prisma-schema-v1',
  actorKey: 'athlete-trainer-test',
  runtimeKey: 'api-local',
  postgresMajor: 17,
});

const sampleStats = (p50, p95) => ({
  min: Math.min(p50, p95),
  p50,
  p95,
  max: Math.max(p50, p95),
});

function httpReport(latency = 10, bytes = 120, pathOverride) {
  return {
    schemaVersion: 1,
    capturedAt: '2026-11-21T00:00:00.000Z',
    nodeVersion: 'v24.22.3',
    methodology: {
      concurrency: 1,
      warmupPerRoute: 2,
      samplesPerRoute: 25,
      pauseMs: 150,
      latency: 'elapsed time through complete response body read',
      bytes: 'decoded response body size, not network transfer bytes',
    },
    results: ROUTES.map(([route, path], index) => ({
      route,
      path: index === 0 && pathOverride ? pathOverride : path,
      method: 'GET',
      samples: 25,
      latencyMs: sampleStats(latency, latency + 10),
      decodedResponseBytes: sampleStats(bytes, bytes + 8),
    })),
  };
}

function sqlReport(count = 5) {
  return {
    schemaVersion: 1,
    method: 'test-scoped Prisma query events; serial HTTP requests',
    warmups: 1,
    results: ROUTES.map(([route]) => ({
      route,
      samples: 5,
      queryCount: sampleStats(count, count + 2),
    })),
  };
}

function explainReport(executionMs = 0.2) {
  return {
    schemaVersion: 1,
    fixtureRowsPerTable: 128,
    postgres: 'JSON EXPLAIN ANALYZE BUFFERS; SELECT statements only',
    plans: ROUTES.map(([route]) => ({
      route,
      rows: 128,
      plan: {
        planningMs: 0.1,
        executionMs,
        root: {
          nodeType: 'Limit',
          sharedHitBlocks: 11,
          sharedReadBlocks: 0,
          children: [
            {
              nodeType: 'Seq Scan',
              relation: 'users',
              index: 'fake_key',
              'Index Cond': 'password=secret-not-for-output',
            },
          ],
        },
      },
    })),
  };
}

function bundle(commit, { latency = 10, bytes = 120, count = 5, time = 0.2 } = {}) {
  const source = (report) => ({ context: context(commit), report });
  return {
    schemaVersion: 1,
    sources: {
      http: source(httpReport(latency, bytes)),
      sql: source(sqlReport(count)),
      explain: source(explainReport(time)),
    },
  };
}

describe('API performance comparison guardrails', () => {
  it('compares three independent report formats without mixing methods or leaking plan contents', () => {
    const before = bundle(INITIAL);
    const after = bundle(UPDATED, { latency: 8, bytes: 116, count: 4, time: 0.15 });
    const output = compareApiPerformance(before, after);
    assert.deepEqual(
      output.comparisons.map((x) => x.source),
      ['http', 'sql', 'explain'],
    );
    assert.equal(output.comparisons[0].beforeCommit, INITIAL);
    assert.equal(output.comparisons[0].afterCommit, UPDATED);
    const httpP95 = output.comparisons[0].metrics.find(
      (x) => x.route === 'users-me' && x.metric === 'latency-p95-ms',
    );
    assert.equal(httpP95.before, 20);
    assert.equal(httpP95.after, 18);
    assert.equal(httpP95.delta, -2);
    assert.equal(httpP95.percentDelta, -10);
    const sql = output.comparisons[1].metrics.find((x) => x.metric === 'queries-p50');
    assert.equal(sql.delta, -1);
    assert.equal(sql.percentDelta, -20);
    const plan = output.comparisons[2].metrics.find((x) => x.metric === 'sql-execution-ms');
    assert.equal(plan.before, 0.2);
    assert.equal(plan.after, 0.15);
    assert.equal(plan.percentDelta, -25);
    const json = JSON.stringify(output);
    assert.doesNotMatch(
      json,
      /password|secret|Index Cond|fake_key|users_pkey|fixtureKey|read-fixture-v1/,
    );
    assert.equal(output.comparisons[0].metrics.length, 16);
    assert.equal(output.comparisons[1].metrics.length, 8);
    assert.equal(output.comparisons[2].metrics.length, 16);
  });

  it('supports partial captures but forbids missing corresponding sources and unknown types', () => {
    const before = bundle(INITIAL);
    const after = bundle(UPDATED);
    delete before.sources.sql;
    delete after.sources.sql;
    delete before.sources.explain;
    delete after.sources.explain;
    assert.deepEqual(
      compareApiPerformance(before, after).comparisons.map((x) => x.source),
      ['http'],
    );
    delete after.sources.http;
    assert.throws(() => compareApiPerformance(before, after), /Missing corresponding http capture/);
    after.sources.http = before.sources.http;
    before.sources.bad = { content: 'not accepted' };
    assert.throws(() => compareApiPerformance(before, after), /Unknown performance source/);
    delete before.sources.bad;
    delete before.sources.http;
    assert.throws(() => compareApiPerformance(before, after), /At least one performance source/);
  });

  it('fails closed when a source has incompatible fixture, schema, role, environment or runtime', () => {
    for (const [key, replacement] of [
      ['fixtureKey', 'different-fixture'],
      ['environmentKey', 'different-hardware'],
      ['dbSchemaKey', 'different-schema'],
      ['actorKey', 'admin-instead-of-trainer'],
      ['runtimeKey', 'different-node-settings'],
      ['postgresMajor', 16],
    ]) {
      const before = bundle(INITIAL);
      const after = bundle(UPDATED);
      after.sources.sql.context[key] = replacement;
      assert.throws(() => compareApiPerformance(before, after), new RegExp(key));
    }
  });

  it('rejects unrecognized routes and duplicated routes', () => {
    const before = bundle(INITIAL);
    const after = bundle(UPDATED);
    after.sources.http.report.results[0].route = 'untrusted-secret-token';
    assert.throws(() => compareApiPerformance(before, after), /Invalid or repeated http route/);
    after.sources.http.report.results[0].route = 'users-me';
    after.sources.http.report.results[1].route = 'users-me';
    assert.throws(() => compareApiPerformance(before, after), /Invalid or repeated http route/);
  });

  it('rejects misleading capture parity: URL, sample count, methodology, SQL, EXPLAIN and Node versions', () => {
    const changes = [
      (x) => {
        x.sources.http.report.results[0].path = '/users/me?include=secrets';
      },
      (x) => {
        x.sources.http.report.methodology.pauseMs = 0;
      },
      (x) => {
        x.sources.http.report.methodology.samplesPerRoute = 20;
      },
      (x) => {
        x.sources.http.report.nodeVersion = 'v23.0.0';
      },
      (x) => {
        x.sources.sql.report.warmups = 2;
      },
      (x) => {
        x.sources.sql.report.results[0].samples = 6;
      },
      (x) => {
        x.sources.explain.report.fixtureRowsPerTable = 256;
      },
      (x) => {
        x.sources.explain.report.plans[0].rows = 256;
      },
    ];
    for (const change of changes) {
      const before = bundle(INITIAL);
      const after = bundle(UPDATED);
      change(after);
      assert.throws(
        () => compareApiPerformance(before, after),
        /Incompatible|sample count differs/,
      );
    }
  });

  it('validates numeric metrics and percentile ordering instead of accepting malformed data', () => {
    const before = bundle(INITIAL);
    const after = bundle(UPDATED);
    after.sources.http.report.results[0].latencyMs.p95 = -1;
    assert.throws(() => compareApiPerformance(before, after), /Invalid/);
    after.sources.http.report.results[0].latencyMs.p95 = 2;
    assert.throws(() => compareApiPerformance(before, after), /Inconsistent/);
    after.sources.http.report.results[0].latencyMs.p95 = Number.NaN;
    assert.throws(() => compareApiPerformance(before, after), /Invalid/);
  });

  it('treats percentage change from a zero baseline as undefined, not infinity', () => {
    const before = bundle(INITIAL);
    const after = bundle(UPDATED);
    before.sources.explain.report.plans[0].plan.root.sharedReadBlocks = 0;
    after.sources.explain.report.plans[0].plan.root.sharedReadBlocks = 12;
    const result = compareApiPerformance(before, after);
    const blocks = result.comparisons[2].metrics.find(
      (x) => x.route === 'users-me' && x.metric === 'shared-read-blocks',
    );
    assert.equal(blocks.delta, 12);
    assert.equal(blocks.percentDelta, null);
  });

  it('the CLI compares two actual JSON bundle files and emits machine-readable output', () => {
    const directory = mkdtempSync(join(tmpdir(), 'gym-perf-compare-'));
    try {
      const firstPath = join(directory, 'before.json');
      const secondPath = join(directory, 'after.json');
      writeFileSync(firstPath, JSON.stringify(bundle(INITIAL)));
      writeFileSync(secondPath, JSON.stringify(bundle(UPDATED, { latency: 8 })));
      const child = spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('./api-performance-compare.mjs', import.meta.url)),
          firstPath,
          secondPath,
        ],
        { encoding: 'utf8' },
      );
      assert.equal(child.status, 0, child.stderr);
      assert.equal(child.stderr, '');
      const compared = JSON.parse(child.stdout);
      assert.equal(compared.schemaVersion, 1);
      assert.equal(compared.comparisons[0].metrics[1].delta, -2);
      assert.doesNotMatch(child.stdout, /fixtureKey|read-fixture-v1|Index Cond/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('the CLI never echoes malformed JSON, file paths or secret-looking input', () => {
    const directory = mkdtempSync(join(tmpdir(), 'gym-perf-compare-'));
    const malformedFile = join(directory, 'do-not-print-this-path.json');
    const otherFile = join(directory, 'after.json');
    const marker = 'very-sensitive-token-DO-NOT-PRINT';
    try {
      writeFileSync(malformedFile, '{"token":"' + marker + '",broken:}');
      writeFileSync(otherFile, JSON.stringify(bundle(UPDATED)));
      const child = spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('./api-performance-compare.mjs', import.meta.url)),
          malformedFile,
          otherFile,
        ],
        { encoding: 'utf8' },
      );
      assert.equal(child.status, 1);
      assert.match(child.stderr, /invalid input or file/);
      assert.doesNotMatch(child.stderr, /very-sensitive|do-not-print-this-path|token/);
      assert.equal(child.stdout, '');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not require HTTP and EXPLAIN to have the same fixture label within one bundle', () => {
    const before = bundle(INITIAL);
    const after = bundle(UPDATED);
    for (const item of [before, after]) {
      item.sources.explain.context.fixtureKey = 'explain-128-rollback-v1';
      item.sources.sql.context.fixtureKey = 'two-accounts-only-v1';
    }
    assert.equal(compareApiPerformance(before, after).comparisons.length, 3);
  });
});
