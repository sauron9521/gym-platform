import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { REQUIRED_CHECKS } from './production-readiness.mjs';
import { PHASES } from './staging-upgrade-rollback.mjs';
import {
  assertSameArtifact,
  validateRunId,
  verifyOriginMetadata,
} from './production-release-origin.mjs';

const now = new Date('2026-11-13T15:00:00Z');
const runId = 43427914603;
const source = 'c'.repeat(40);
const digest = (name, character) =>
  'ghcr.io/sauron9521/' + name + '@sha256:' + character.repeat(64);
const report = () => ({
  schemaVersion: 1,
  kind: 'release-readiness-evidence',
  releaseEvidence: 'VERIFIED',
  decision: 'NO-GO',
  decisionScope: 'PRODUCTION_DEPLOYMENT',
  verifiedAt: '2026-11-13T13:59:00Z',
  sourceSha: source,
  publisherSha: 'd'.repeat(40),
  runtime: digest('gym-platform', 'a'),
  migrate: digest('gym-platform-migrate', 'b'),
  previous: { runtime: digest('gym-platform', 'e'), sourceSha: 'e'.repeat(40) },
  publisherRunId: 111111,
  stagingRunId: 222222,
  ciRunId: 333333,
  verifiedOciAttestations: true,
  productionReleaseApproval: false,
  productionContacted: false,
  deployTriggered: false,
  verifiedChecks: [...REQUIRED_CHECKS],
  verifiedStagingPhases: [...PHASES],
});
const run = () => ({
  id: runId,
  repository: { full_name: 'sauron9521/gym-platform' },
  path: '.github/workflows/production-readiness.yml',
  event: 'workflow_dispatch',
  head_branch: 'main',
  head_sha: source,
  status: 'completed',
  conclusion: 'success',
  run_attempt: 2,
  created_at: '2026-11-13T13:58:00Z',
  updated_at: '2026-11-13T14:01:00Z',
});
const artifacts = () => ({
  total_count: 1,
  artifacts: [{
    id: 123456,
    name: 'release-readiness-' + runId + '-2',
    expired: false,
    size_in_bytes: 1400,
    workflow_run: { id: runId, head_sha: source },
    created_at: '2026-11-13T14:00:00Z',
  }],
});

test('only explicit numeric review run IDs are accepted', () => {
  assert.equal(validateRunId(String(runId)), runId);
  for (const value of ['', 'latest', '0', '-1', '+123', '01', '123;echo bad', 'a'.repeat(16)]) {
    assert.throws(() => validateRunId(value));
  }
});

test('bind successful main/manual review to its exact attempt-specific non-expired artifact', () => {
  assert.deepEqual(verifyOriginMetadata(run(), artifacts(), report(), runId, now), {
    runId,
    attempt: 2,
    artifactName: 'release-readiness-' + runId + '-2',
  });
});

test('reject wrong repository, workflow, event, branch, conclusion or attempt', () => {
  const changes = [
    (r) => { r.repository.full_name = 'attacker/repository'; },
    (r) => { r.path = '.github/workflows/fake.yml'; },
    (r) => { r.event = 'pull_request'; },
    (r) => { r.head_branch = 'feature/untrusted'; },
    (r) => { r.head_sha = 'invalid'; },
    (r) => { r.status = 'in_progress'; },
    (r) => { r.conclusion = 'failure'; },
    (r) => { r.run_attempt = 1; },
    (r) => { r.run_attempt = 0; },
    (r) => { r.id = runId + 1; },
    (r) => { r.created_at = '2026-11-13T14:05:00Z'; },
    (r) => { r.updated_at = '2026-11-20T14:01:00Z'; },
  ];
  for (const mutate of changes) {
    const item = run();
    mutate(item);
    assert.throws(() => verifyOriginMetadata(item, artifacts(), report(), runId, now));
  }
});

test('reject expired, duplicate, wrong-run, stale and mismatched GitHub artifacts', () => {
  const cases = [
    (a) => { a.artifacts[0].name = 'release-readiness-' + runId + '-1'; },
    (a) => { a.artifacts[0].expired = true; },
    (a) => { a.artifacts[0].workflow_run.id = runId + 2; },
    (a) => { a.artifacts[0].workflow_run.head_sha = 'f'.repeat(40); },
    (a) => { a.artifacts[0].size_in_bytes = 5_000_000; },
    (a) => { a.artifacts[0].created_at = '2026-11-12T12:00:00Z'; },
    (a) => { a.total_count = 101; },
    (a) => { a.total_count = 2; a.artifacts.push({ ...a.artifacts[0] }); },
  ];
  for (const mutate of cases) {
    const item = artifacts();
    mutate(item);
    assert.throws(() => verifyOriginMetadata(run(), item, report(), runId, now));
  }
  assert.throws(() =>
    verifyOriginMetadata(run(), artifacts(), { ...report(), verifiedAt: '2026-11-12T12:00:00Z' }, runId, now),
  );
  assert.throws(() =>
    verifyOriginMetadata(run(), artifacts(), report(), runId, new Date('2026-11-22T00:00:00Z')),
  );
});

test('compare raw SHA-256 of downloaded original artifact with local report', () => {
  const content = Buffer.from(JSON.stringify(report()) + '\n');
  assert.equal(assertSameArtifact(content, Buffer.from(content)), true);
  const tampered = Buffer.from(content);
  tampered[tampered.length - 5] ^= 1;
  assert.throws(() => assertSameArtifact(content, tampered));
  assert.throws(() => assertSameArtifact(content, Buffer.alloc(0)));
  assert.throws(() => assertSameArtifact(content, Buffer.alloc(129_000)));
});

test('operator preflight requires verified GitHub origin BEFORE backup/OCI/Docker inspection', async () => {
  const shell = await readFile(new URL('./production-host-preflight.sh', import.meta.url), 'utf8');
  const ci = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const origin = await readFile(new URL('./production-release-origin.mjs', import.meta.url), 'utf8');
  const evidence = shell.indexOf('node scripts/production-host-preflight.mjs evidence');
  const originCheck = shell.indexOf('node scripts/production-release-origin.mjs verify');
  const backup = shell.indexOf('sha256sum --check --status SHA256SUMS');
  const docker = shell.indexOf('node scripts/production-digest-guard.mjs images');
  assert.ok(evidence > 0 && evidence < originCheck && originCheck < backup && backup < docker);
  assert.match(shell, /RELEASE_REVIEW_RUN_ID/);
  assert.match(origin, /gh run download|['"]run['"], ['"]download['"]/);
  assert.match(origin, /release-readiness-/);
  assert.match(origin, /workflow_dispatch/);
  assert.match(origin, /rmSync\(scratch/);
  assert.ok(ci.includes('node --test scripts/production-release-origin.test.mjs'));
  assert.ok(!shell.includes('production-digest-deploy.sh'));
  assert.doesNotMatch(shell, /docker (pull|run|push|build|stop|start)/);
});
