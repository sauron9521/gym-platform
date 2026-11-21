import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, lstatSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

import {
  inspectStagingReadiness,
  readPrivateStagingInventory,
} from './staging-readiness-inventory.mjs';

const evidence = {
  stagingApiOrigin: 'https://staging-api.example.test',
  stagingWebOrigin: 'https://staging-app.example.test',
  postgresRestoreEvidenceId: 'restore-verified-1',
  avatarRestoreEvidenceId: 'avatar-restore-1',
  tlsProxyEvidenceId: 'tls-proxy-verified-1',
  smtpDeliveryEvidenceId: 'smtp-delivery-1',
  redisFailClosedEvidenceId: 'redis-outage-verified-1',
  browserRealApiSmokeEvidenceId: 'browser-smoke-verified-1',
  androidMaestroEvidenceId: 'maestro-staging-run-1',
  rollbackRehearsalEvidenceId: 'rollback-staging-run-1',
  alertDeliveryEvidenceId: 'alert-delivered-1',
};

const scriptPath = fileURLToPath(new URL('./staging-readiness-inventory.mjs', import.meta.url));

test('complete reference inventory is STILL NO_GO and never claims verification', () => {
  const report = inspectStagingReadiness(evidence);
  assert.deepEqual(report.missing, []);
  assert.equal(report.status, 'SUBMITTED_REQUIRES_INDEPENDENT_REVIEW');
  assert.equal(report.decision, 'NO_GO');
  assert.equal(report.independentVerificationPerformed, false);
  assert.equal(report.deploymentAuthorized, false);
  assert.equal(report.productionContacted, false);
  assert.equal(report.deployTriggered, false);
});

test('missing, invalid and spoofed evidence fails closed without leaking values', () => {
  const invalid = {
    ...evidence,
    stagingApiOrigin: 'http://localhost:3001',
    stagingWebOrigin: 'https://user:secret@staging.example.test',
    smtpDeliveryEvidenceId: 'Bearer secret',
    rollbackRehearsalEvidenceId: '',
    deploymentAuthorized: true,
    decision: 'GO',
  };
  const report = inspectStagingReadiness(invalid);
  assert.deepEqual(report.missing, [
    'stagingApiOrigin',
    'stagingWebOrigin',
    'smtpDeliveryEvidenceId',
    'rollbackRehearsalEvidenceId',
  ]);
  assert.equal(report.decision, 'NO_GO');
  assert.equal(report.deploymentAuthorized, false);
  assert.equal(report.status, 'INCOMPLETE');
  assert.ok(!JSON.stringify(report).includes('secret'));
  assert.ok(!JSON.stringify(report).includes('localhost'));
});

test('identical, non-HTTPS and path-bearing origins cannot be listed as ready', () => {
  for (const origin of [
    'http://staging.example.test',
    'https://staging.example.test/',
    'https://staging.example.test/path',
    'https://staging.example.test/?token=secret',
    'https://user:secret@staging.example.test',
    'file:///tmp/staging',
    'not-an-origin',
  ]) {
    assert.ok(inspectStagingReadiness({ ...evidence, stagingApiOrigin: origin }).missing.length);
  }
  const repeated = inspectStagingReadiness({
    ...evidence,
    stagingApiOrigin: evidence.stagingWebOrigin,
  });
  assert.ok(repeated.missing.includes('distinctStagingWebAndApiOrigins'));
});

test('empty, non-object or fake approval objects can never authorize a deployment', () => {
  for (const input of [null, undefined, 0, [], 'staging', {}, { decision: 'GO' }]) {
    const report = inspectStagingReadiness(input);
    assert.equal(report.status, 'INCOMPLETE');
    assert.equal(report.decision, 'NO_GO');
    assert.equal(report.deploymentAuthorized, false);
    assert.ok(report.missing.length > 0);
  }
});

test('a complete JSON file is only inventory-complete, with explicit NO_GO output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gym-staging-inventory-'));
  try {
    const path = join(dir, 'evidence.json');
    writeFileSync(path, JSON.stringify(evidence), { mode: 0o600 });
    assert.deepEqual(readPrivateStagingInventory(path), evidence);

    const result = spawnSync(process.execPath, [scriptPath, path], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.decision, 'NO_GO');
    assert.equal(report.deploymentAuthorized, false);
    assert.ok(!result.stdout.includes(evidence.postgresRestoreEvidenceId));
    assert.ok(!result.stdout.includes(evidence.stagingApiOrigin));
    assert.equal(result.stderr, '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI rejects invalid private files and does not print their content or path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gym-staging-inventory-'));
  try {
    const path = join(dir, 'private-evidence.json');
    writeFileSync(path, '{"secret":"sensitive-value"}', { mode: 0o600 });
    const invalid = spawnSync(process.execPath, [scriptPath, path], { encoding: 'utf8' });
    assert.equal(invalid.status, 1);
    assert.ok(!invalid.stdout.includes('sensitive-value'));
    assert.ok(!invalid.stdout.includes(path));

    assert.throws(() => readPrivateStagingInventory('./private-evidence.json'));
    assert.throws(() => readPrivateStagingInventory(dir));

    const link = join(dir, 'link.json');
    symlinkSync(path, link);
    assert.equal(lstatSync(link).isSymbolicLink(), true);
    assert.throws(() => readPrivateStagingInventory(link));
    const linked = spawnSync(process.execPath, [scriptPath, link], { encoding: 'utf8' });
    assert.equal(linked.status, 2);
    assert.ok(!linked.stderr.includes(path));

    writeFileSync(path, 'x'.repeat(128_001));
    assert.throws(() => readPrivateStagingInventory(path));

    writeFileSync(path, '{}');
    chmodSync(path, 0o640);
    if (process.platform !== 'win32') {
      assert.throws(() => readPrivateStagingInventory(path));
    }
    chmodSync(path, 0o666);
    if (process.platform !== 'win32') {
      assert.throws(() => readPrivateStagingInventory(path));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects a complete-looking untrusted file and never uses it to authorize deployment', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gym-staging-inventory-'));
  try {
    const path = join(dir, 'evidence.json');
    const spoofed = {
      ...evidence,
      decision: 'GO',
      deploymentAuthorized: true,
      productionContacted: true,
      deployTriggered: true,
      independentVerificationPerformed: true,
    };
    writeFileSync(path, JSON.stringify(spoofed), { mode: 0o600 });
    const result = spawnSync(process.execPath, [scriptPath, path], { encoding: 'utf8' });
    assert.equal(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.decision, 'NO_GO');
    for (const key of [
      'deploymentAuthorized',
      'productionContacted',
      'deployTriggered',
      'independentVerificationPerformed',
    ]) {
      assert.equal(report[key], false);
    }
    assert.ok(!result.stdout.includes(evidence.postgresRestoreEvidenceId));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects group-readable evidence on POSIX and accepts owner-only files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gym-staging-inventory-'));
  try {
    const path = join(dir, 'evidence.json');
    writeFileSync(path, JSON.stringify(evidence), { mode: 0o600 });
    if (process.platform !== 'win32') {
      chmodSync(path, 0o644);
      assert.throws(() => readPrivateStagingInventory(path));
      chmodSync(path, 0o600);
    }
    assert.deepEqual(readPrivateStagingInventory(path), evidence);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
