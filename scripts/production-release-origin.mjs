#!/usr/bin/env node
// Operator-host verification of the original GitHub Actions readiness artifact.
// Read-only GitHub operations; temporary local download is always removed.
// A successful match remains production NO-GO, not deployment approval.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validatePrivateFile, validateReleaseReport } from './production-host-preflight.mjs';

const REPO = 'sauron9521/gym-platform';
const WORKFLOW = '.github/workflows/production-readiness.yml';
const RUN_ID = /^[1-9][0-9]{0,15}$/;
const SHA = /^[a-f0-9]{40}$/;
const MAX_BYTES = 128_000;

export function validateRunId(value) {
  assert.match(value ?? '', RUN_ID, 'An explicit GitHub review run ID is required');
  const id = Number(value);
  assert.ok(Number.isSafeInteger(id), 'Review run ID is outside safe range');
  return id;
}

export function verifyOriginMetadata(run, listing, report, requestedRunId, now = new Date()) {
  const id = validateRunId(String(requestedRunId));
  assert.equal(run?.id, id, 'Wrong release review run');
  assert.equal(run?.repository?.full_name, REPO, 'Untrusted source repository');
  assert.equal(run?.path, WORKFLOW, 'Untrusted workflow');
  assert.equal(run?.event, 'workflow_dispatch', 'Release review was not manually invoked');
  assert.equal(run?.head_branch, 'main', 'Review must originate from protected main');
  assert.match(run?.head_sha ?? '', SHA);
  assert.equal(run?.status, 'completed');
  assert.equal(run?.conclusion, 'success', 'Readiness review did not succeed');

  const attempt = run?.run_attempt;
  assert.ok(Number.isSafeInteger(attempt) && attempt >= 1 && attempt <= 999_999);
  assert.ok(listing?.total_count >= 1 && listing.total_count <= 100);
  assert.ok(Array.isArray(listing?.artifacts));
  assert.equal(
    listing.artifacts.length,
    listing.total_count,
    'Partial artifact listing is untrusted',
  );

  const artifactName = 'release-readiness-' + id + '-' + attempt;
  const matching = listing.artifacts.filter((value) => value?.name === artifactName);
  assert.equal(matching.length, 1, 'Expected exactly one exact-attempt readiness artifact');
  const artifact = matching[0];
  assert.equal(artifact?.expired, false, 'Readiness artifact expired');
  assert.ok(Number.isSafeInteger(artifact?.id) && artifact.id > 0);
  assert.ok(Number.isSafeInteger(artifact?.size_in_bytes));
  assert.ok(artifact.size_in_bytes >= 1 && artifact.size_in_bytes <= 1_000_000);
  assert.equal(artifact?.workflow_run?.id, id);
  if (artifact.workflow_run.head_sha != null) {
    assert.equal(artifact.workflow_run.head_sha, run.head_sha);
  }

  const created = Date.parse(run?.created_at ?? '');
  const updated = Date.parse(run?.updated_at ?? '');
  const uploaded = Date.parse(artifact?.created_at ?? '');
  const verified = Date.parse(report?.verifiedAt ?? '');
  const current = now.getTime();
  assert.ok([created, updated, uploaded, verified, current].every(Number.isFinite));
  assert.ok(created <= verified && verified <= updated + 60_000);
  assert.ok(created <= uploaded && uploaded <= updated + 60_000);
  assert.ok(updated <= current + 60_000 && updated >= created);
  assert.ok(current - updated <= 7 * 86_400_000, 'Stale GitHub review run');

  return { runId: id, attempt, artifactName };
}

export function assertSameArtifact(localBytes, downloadedBytes) {
  assert.ok(Buffer.isBuffer(localBytes) && Buffer.isBuffer(downloadedBytes));
  assert.ok(localBytes.length > 0 && localBytes.length <= MAX_BYTES);
  assert.ok(downloadedBytes.length > 0 && downloadedBytes.length <= MAX_BYTES);
  const localHash = createHash('sha256').update(localBytes).digest();
  const sourceHash = createHash('sha256').update(downloadedBytes).digest();
  assert.ok(
    timingSafeEqual(localHash, sourceHash),
    'Local release receipt differs from GitHub artifact',
  );
  return true;
}

function gh(args) {
  // A trusted GitHub CLI installation and account are prerequisites.
  // Never log API responses or error payloads (they may include private data).
  return execFileSync('gh', args, {
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 2_000_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export async function checkGithubOrigin(env, now = new Date()) {
  const runId = validateRunId(env?.RELEASE_REVIEW_RUN_ID);
  assert.ok(
    !process.env.GH_HOST || process.env.GH_HOST === 'github.com',
    'GitHub CLI must use github.com, not an alternate host',
  );
  await validatePrivateFile(env?.PRODUCTION_RELEASE_REPORT, MAX_BYTES);
  const local = readFileSync(env.PRODUCTION_RELEASE_REPORT);
  const report = JSON.parse(local.toString('utf8'));
  validateReleaseReport(report, env, now);

  const run = JSON.parse(gh(['api', 'repos/' + REPO + '/actions/runs/' + runId]));
  const artifacts = JSON.parse(
    gh(['api', 'repos/' + REPO + '/actions/runs/' + runId + '/artifacts?per_page=100']),
  );
  const meta = verifyOriginMetadata(run, artifacts, report, runId, now);

  const scratch = mkdtempSync(join(tmpdir(), 'gym-release-origin-'));
  try {
    gh([
      'run',
      'download',
      String(meta.runId),
      '--repo',
      REPO,
      '--name',
      meta.artifactName,
      '--dir',
      scratch,
    ]);
    const files = readdirSync(scratch);
    assert.deepEqual(files, ['release-evidence.json'], 'Unexpected readiness artifact contents');
    const source = join(scratch, files[0]);
    const st = lstatSync(source);
    assert.ok(st.isFile() && !st.isSymbolicLink() && st.size <= MAX_BYTES);
    assertSameArtifact(local, readFileSync(source));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return { runId, attempt: meta.attempt };
}

async function main() {
  try {
    if (process.argv.length !== 3 || process.argv[2] !== 'verify') {
      throw new Error('Usage: node scripts/production-release-origin.mjs verify');
    }
    await checkGithubOrigin(process.env);
    process.stdout.write(
      'Original successful GitHub Actions release-evidence artifact matches; ' +
        'production NO-GO without host restore and explicit operator approval.\n',
    );
  } catch {
    process.stderr.write(
      'GitHub readiness run or original release evidence could not be verified (NO-GO)\n',
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
