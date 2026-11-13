#!/usr/bin/env node
// Read-only, offline validation for an operator-host preflight.
// It never grants permission to deploy or authenticates an untrusted JSON receipt.
import assert from 'node:assert/strict';
import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateIdentity } from './production-digest-guard.mjs';
import { REQUIRED_CHECKS } from './production-readiness.mjs';
import { PHASES } from './staging-upgrade-rollback.mjs';

const RUN_ID = /^[1-9][0-9]{0,15}$/;
const SHA = /^[a-f0-9]{40}$/;
const FILES = ['postgres.dump', 'avatars.tar.gz'];

export function validateReleaseReport(report, env, now = new Date()) {
  const identity = validateIdentity(env);
  assert.equal(report?.schemaVersion, 1);
  assert.equal(report?.kind, 'release-readiness-evidence');
  assert.equal(report?.releaseEvidence, 'VERIFIED');
  assert.equal(report?.decision, 'NO-GO');
  assert.equal(report?.decisionScope, 'PRODUCTION_DEPLOYMENT');
  assert.equal(report?.productionReleaseApproval, false);
  assert.equal(report?.productionContacted, false);
  assert.equal(report?.deployTriggered, false);
  assert.equal(report?.verifiedOciAttestations, true);

  assert.equal(report?.runtime, identity.runtime);
  assert.equal(report?.migrate, identity.migrate);
  assert.equal(report?.sourceSha, identity.sourceSha);
  assert.equal(report?.publisherSha, identity.publisherSha);
  assert.match(report?.sourceSha ?? '', SHA);
  assert.match(report?.publisherSha ?? '', SHA);
  assert.match(String(report?.publisherRunId ?? ''), RUN_ID);
  assert.match(String(report?.stagingRunId ?? ''), RUN_ID);
  assert.match(String(report?.ciRunId ?? ''), RUN_ID);
  assert.deepEqual(report?.verifiedChecks, REQUIRED_CHECKS);
  assert.deepEqual(report?.verifiedStagingPhases, PHASES);
  assert.equal(report?.previous?.runtime?.startsWith('ghcr.io/sauron9521/gym-platform@sha256:'), true);

  const age = now.getTime() - Date.parse(report?.verifiedAt ?? '');
  assert.ok(Number.isFinite(age) && age >= 0 && age <= 7 * 86_400_000,
    'Release receipt must be current (seven days maximum)');
  // The receipt is an input for a human review, not a cryptographic proof.
  // OCI attestations are verified independently in the host preflight.
  return identity;
}

export function validateBackupManifest(text) {
  assert.ok(typeof text === 'string' && text.length < 4096, 'Invalid backup checksum manifest');
  const found = new Map();
  const lines = text.trim().split('\n');
  assert.equal(lines.length, FILES.length, 'Expected exactly two backup checksums');
  for (const line of lines) {
    const match = /^([a-f0-9]{64})  (postgres\.dump|avatars\.tar\.gz)$/.exec(line);
    assert.ok(match, 'Unsafe or malformed checksum entry');
    assert.ok(!found.has(match[2]), 'Duplicate checksum entry');
    found.set(match[2], match[1]);
  }
  for (const name of FILES) assert.ok(found.has(name), 'Missing archive checksum: ' + name);
  return found;
}

export async function validatePrivateFile(path, maximumBytes = 128_000) {
  assert.ok(typeof path === 'string' && isAbsolute(path), 'Absolute private path required');
  const st = await lstat(path);
  assert.ok(st.isFile() && !st.isSymbolicLink(), 'Regular non-symlink file required');
  assert.ok(st.size > 0 && st.size <= maximumBytes, 'Unexpected file size');
  assert.equal(st.mode & 0o022, 0, 'Group/world-writable private file forbidden');
  return st;
}

export async function inspectBackupDirectory(directory) {
  assert.ok(typeof directory === 'string' && isAbsolute(directory));
  const st = await lstat(directory);
  assert.ok(st.isDirectory() && !st.isSymbolicLink(), 'Private backup directory required');
  assert.equal(st.mode & 0o022, 0, 'Untrusted backup directory write permissions');
  const manifestPath = join(directory, 'SHA256SUMS');
  await validatePrivateFile(manifestPath, 4096);
  const sums = validateBackupManifest(await readFile(manifestPath, 'utf8'));
  for (const file of FILES) await validatePrivateFile(join(directory, file), 50_000_000_000);
  return sums;
}

export async function checkEvidenceFiles(env, now = new Date()) {
  await validatePrivateFile(env?.PRODUCTION_RELEASE_REPORT);
  const report = JSON.parse(await readFile(env.PRODUCTION_RELEASE_REPORT, 'utf8'));
  const identity = validateReleaseReport(report, env, now);
  await inspectBackupDirectory(env?.BACKUP_DIR);
  return { identity, report };
}

async function main() {
  try {
    if (process.argv.length !== 3 || process.argv[2] !== 'evidence') {
      throw new Error('Usage: node scripts/production-host-preflight.mjs evidence');
    }
    const { report } = await checkEvidenceFiles(process.env);
    // No evidence record is trustworthy merely because the file parses.
    process.stdout.write(
      'Release receipt and backup manifest structure checked; ' +
      'production NO-GO until OCI verification, backup archive checks, ' +
      'real restore, host review and operator approval.\n',
    );
    assert.equal(report.productionReleaseApproval, false);
  } catch {
    process.stderr.write('Operator preflight evidence rejected (production NO-GO)\n');
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
