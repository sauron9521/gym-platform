import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

import {
  compareAB,
  extractProfileFromLog,
  preflightAB,
  sanitizeProfile,
} from './api-performance-ab.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const FINGERPRINT = 'f'.repeat(64);
const ROUTES = [
  ['users-me', '/users/me'],
  ['workouts-summary', '/workouts?view=summary&limit=20'],
  ['training-programs', '/training-programs?limit=20'],
  ['exercises', '/exercises?limit=20'],
];

const stats = (value) => ({ min: value, p50: value, p95: value, max: value });

function profile(fingerprint = FINGERPRINT, latency = 12) {
  return {
    schemaVersion: 1,
    fixture: {
      recipe: 'http-reads-populated-v1-128',
      fingerprint,
      athleteAccounts: 1,
      trainerAccounts: 1,
      workouts: 128,
      trainingPrograms: 128,
      trainingProgramVersions: 128,
      exercises: 128,
    },
    http: {
      schemaVersion: 1,
      capturedAt: '2026-11-21T19:10:07.830Z',
      nodeVersion: 'v24.22.3',
      methodology: {
        concurrency: 1,
        warmupPerRoute: 2,
        samplesPerRoute: 25,
        pauseMs: 0,
        latency: 'elapsed time through complete response body read',
        bytes: 'decoded response body size, not network transfer bytes',
      },
      results: ROUTES.map(([route, path]) => ({
        route,
        path,
        method: 'GET',
        samples: 25,
        latencyMs: stats(latency),
        decodedResponseBytes: stats(1024),
      })),
    },
    sql: {
      schemaVersion: 1,
      method: 'test-scoped Prisma query events; serial HTTP requests',
      warmups: 2,
      results: ROUTES.map(([route]) => ({
        route,
        samples: 25,
        queryCount: stats(7),
      })),
    },
  };
}

const manifest = () => ({
  schemaVersion: 1,
  beforeCommit: SHA_A,
  afterCommit: SHA_B,
  dbSchemaKey: 'e'.repeat(64),
  method: 'two isolated PostgreSQL 17 test DBs on one runner, identical pinned fixture code',
});

describe('API A/B comparison runner', () => {
  it('safely compares paired HTTP/SQL profiles and never invents EXPLAIN results', () => {
    const compared = compareAB(manifest(), profile(), profile(FINGERPRINT, 10));
    assert.equal(compared.schemaVersion, 1);
    assert.equal(compared.comparisons.length, 2);
    assert.deepEqual(
      compared.comparisons.map((x) => x.source),
      ['http', 'sql'],
    );
    assert.equal(compared.comparisons[0].beforeCommit, SHA_A);
    assert.equal(compared.comparisons[0].afterCommit, SHA_B);
    assert.equal(
      compared.comparisons[0].metrics.find((m) => m.metric === 'latency-p95-ms').delta,
      -2,
    );
    assert.equal(compared.mode, 'A/B exploratory comparison');
    assert.equal(compared.fixtureFingerprint, FINGERPRINT);
  });

  it('distinguishes a same-revision A/A smoke run from a real code-change comparison', () => {
    const m = manifest();
    m.afterCommit = m.beforeCommit;
    assert.match(compareAB(m, profile(), profile()).mode, /A\/A pipeline smoke/);
  });

  it('rejects invalid fixture hashes, non-matching hashes, and incompatible source methods', () => {
    assert.throws(
      () => compareAB(manifest(), profile(), profile('f'.repeat(63) + 'a')),
      /fingerprints differ/,
    );
    assert.throws(
      () => compareAB(manifest(), profile(), profile('not a valid fingerprint')),
      /Missing persisted fixture fingerprint/,
    );
    const after = profile();
    after.http.methodology.samplesPerRoute = 10;
    assert.throws(() => compareAB(manifest(), profile(), after), /measurement settings/);
    const badManifest = manifest();
    badManifest.dbSchemaKey = 'not-a-hash';
    assert.throws(() => compareAB(badManifest, profile(), profile()), /pinned A\/B manifest/);
  });

  it('rejects missing, duplicated, unknown, unapproved HTTP routes and nonnumeric metrics', () => {
    const p = profile();
    p.http.results.pop();
    assert.throws(() => sanitizeProfile(p), /Incomplete HTTP routes/);

    const duplicated = profile();
    duplicated.http.results[0].route = 'workouts-summary';
    assert.throws(() => sanitizeProfile(duplicated), /Invalid or incomplete comparison routes/);

    const unapproved = profile();
    unapproved.http.results[0].path = '/admin/users';
    assert.throws(() => sanitizeProfile(unapproved), /Invalid or incomplete comparison routes/);

    const nan = profile();
    nan.http.results[0].latencyMs.p95 = Number.NaN;
    assert.throws(() => sanitizeProfile(nan), /Invalid HTTP latency/);

    const sql = profile();
    sql.sql.results[0].queryCount.p50 = 1.5;
    assert.throws(() => sanitizeProfile(sql), /Invalid SQL query count/);
  });

  it('extracts only allowlisted JSON values; ignores arbitrary sensitive response/SQL fields', () => {
    const p = profile();
    p.token = 'do-not-echo-authorization-token';
    p.http.results[0].responseBody = { email: 'secret@example.test' };
    p.http.results[0].sql = 'SELECT * FROM private_records';
    p.sql.results[0].parameters = ['password secret'];
    const line = '\u001b[39mAPI_PERF_PROFILE ' + JSON.stringify(p);
    const normalized = extractProfileFromLog('safe test startup\n' + line + '\nOther tests passed');
    assert.equal(normalized.fixture.fingerprint, FINGERPRINT);
    assert.doesNotMatch(
      JSON.stringify(normalized),
      /do-not-echo|secret|private_records|parameters|token/i,
    );
    assert.equal(normalized.http.results.length, 4);
  });

  it('refuses duplicate/missing/invalid log reports with only sanitized errors', () => {
    const line = 'API_PERF_PROFILE ' + JSON.stringify(profile());
    assert.throws(() => extractProfileFromLog('No profile here'), /exactly one/);
    assert.throws(() => extractProfileFromLog(line + '\n' + line), /exactly one/);
    assert.throws(
      () => extractProfileFromLog('API_PERF_PROFILE {not-json}'),
      /Invalid profile JSON/,
    );
    assert.throws(() => extractProfileFromLog(line.repeat(14000)), /oversized/);
  });

  it('verifies exact Git commit input with immutable, matching fixture/schema trees', () => {
    const repo = process.cwd();
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const result = preflightAB(repo, repo, sha, sha);
    assert.equal(result.beforeCommit, sha);
    assert.equal(result.dbSchemaKey.length, 64);
    assert.throws(() => preflightAB(repo, repo, SHA_A, sha), /Before checkout does not match/);
    assert.throws(() => preflightAB(repo, repo, 'main', sha), /40-character Git SHAs/);
  });

  it('manual workflow is opt-in, read-only and isolated from production databases', () => {
    const workflow = readFileSync(
      fileURLToPath(new URL('../.github/workflows/api-performance-ab.yml', import.meta.url)),
      'utf8',
    );
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /contents: read/);
    assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
    assert.match(workflow, /gym_perf_before_test/);
    assert.match(workflow, /gym_perf_after_test/);
    assert.match(workflow, /API_PERF_AB_MODE: '1'/);
    assert.match(workflow, /--frozen-lockfile/);
    assert.match(workflow, /api-performance-ab\.mjs preflight/);
    assert.match(workflow, /api-performance-ab\.mjs compare/);
    assert.match(workflow, /comparison\.json/);
    assert.doesNotMatch(workflow, /db:seed|db:migrate:reset|production\.env|secrets\.DATABASE_URL/);
  });

  it('the CLI writes clean files and withholds malformed log and file paths on failures', () => {
    const directory = mkdtempSync(join(tmpdir(), 'api-perf-ab-'));
    const file = fileURLToPath(new URL('./api-performance-ab.mjs', import.meta.url));
    try {
      const log = join(directory, 'do-not-echo-secret-name.log');
      const clean = join(directory, 'before.json');
      const other = join(directory, 'after.json');
      const meta = join(directory, 'manifest.json');
      const compared = join(directory, 'comparison.json');
      writeFileSync(log, 'API_PERF_PROFILE ' + JSON.stringify(profile()) + '\n');
      const extracted = spawnSync(process.execPath, [file, 'extract', log, clean], {
        encoding: 'utf8',
      });
      assert.equal(extracted.status, 0, extracted.stderr);
      assert.deepEqual(JSON.parse(readFileSync(clean, 'utf8')).fixture.fingerprint, FINGERPRINT);
      writeFileSync(other, JSON.stringify(sanitizeProfile(profile(FINGERPRINT, 9))));
      writeFileSync(meta, JSON.stringify(manifest()));
      const comparison = spawnSync(
        process.execPath,
        [file, 'compare', meta, clean, other, compared],
        { encoding: 'utf8' },
      );
      assert.equal(comparison.status, 0, comparison.stderr);
      assert.equal(JSON.parse(readFileSync(compared, 'utf8')).comparisons.length, 2);

      const malformed = join(directory, 'malformed-test-log');
      writeFileSync(malformed, 'API_PERF_PROFILE {"password":"secret-data"}');
      const failed = spawnSync(
        process.execPath,
        [file, 'extract', malformed, join(directory, 'bad.json')],
        { encoding: 'utf8' },
      );
      assert.equal(failed.status, 1);
      assert.match(
        failed.stderr,
        /Invalid fixture|Missing persisted fixture fingerprint|Unsupported deterministic fixture recipe/,
      );
      assert.doesNotMatch(failed.stderr, /secret-data|malformed-test-log/);
      assert.equal(failed.stdout, '');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
