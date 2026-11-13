import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { validateIdentity } from './production-digest-guard.mjs';
import { REQUIRED_CHECKS } from './production-readiness.mjs';
import { PHASES } from './staging-upgrade-rollback.mjs';
import {
  checkEvidenceFiles,
  inspectBackupDirectory,
  validateBackupManifest,
  validatePrivateFile,
  validateReleaseReport,
} from './production-host-preflight.mjs';

const sha = 'c'.repeat(40);
const publisher = 'd'.repeat(40);
const env = {
  DEPLOY_RUNTIME_IMAGE: 'ghcr.io/sauron9521/gym-platform@sha256:' + 'a'.repeat(64),
  DEPLOY_MIGRATE_IMAGE: 'ghcr.io/sauron9521/gym-platform-migrate@sha256:' + 'b'.repeat(64),
  SOURCE_SHA: sha,
  PUBLISH_SHA: publisher,
  EXPECTED_CURRENT_IMAGE: 'none',
};
const now = new Date('2026-11-13T13:00:00Z');
const receipt = () => ({
  schemaVersion: 1,
  kind: 'release-readiness-evidence',
  releaseEvidence: 'VERIFIED',
  decision: 'NO-GO',
  decisionScope: 'PRODUCTION_DEPLOYMENT',
  verifiedAt: '2026-11-13T12:00:00Z',
  productionReleaseApproval: false,
  productionContacted: false,
  deployTriggered: false,
  verifiedOciAttestations: true,
  runtime: env.DEPLOY_RUNTIME_IMAGE,
  migrate: env.DEPLOY_MIGRATE_IMAGE,
  sourceSha: sha,
  publisherSha: publisher,
  publisherRunId: '45678',
  stagingRunId: '56789',
  ciRunId: 12345,
  verifiedChecks: [...REQUIRED_CHECKS],
  verifiedStagingPhases: [...PHASES],
  previous: {
    sourceSha: '1'.repeat(40),
    runtime: 'ghcr.io/sauron9521/gym-platform@sha256:' + '2'.repeat(64),
    migrate: 'ghcr.io/sauron9521/gym-platform-migrate@sha256:' + '3'.repeat(64),
  },
});
const sums = () =>
  'a'.repeat(64) + '  postgres.dump\n' +
  'b'.repeat(64) + '  avatars.tar.gz\n';

test('only exact signed release evidence identities and current NO-GO reports are accepted', () => {
  assert.deepEqual(validateReleaseReport(receipt(), env, now), validateIdentity(env));
  for (const edit of [
    (r) => { r.releaseEvidence = 'FAILED'; },
    (r) => { r.decision = 'GO'; },
    (r) => { r.productionReleaseApproval = true; },
    (r) => { r.productionContacted = true; },
    (r) => { r.deployTriggered = true; },
    (r) => { r.verifiedOciAttestations = false; },
    (r) => { r.publisherRunId = 'not-a-run'; },
    (r) => { r.ciRunId = 0; },
    (r) => { r.runtime = r.previous.runtime; },
    (r) => { r.migrate = r.previous.migrate; },
    (r) => { r.sourceSha = 'f'.repeat(40); },
    (r) => { r.publisherSha = 'e'.repeat(40); },
    (r) => { r.verifiedChecks.pop(); },
    (r) => { r.verifiedStagingPhases[4] = 'omitted'; },
    (r) => { r.verifiedAt = '2026-11-01T00:00:00Z'; },
    (r) => { r.verifiedAt = '2026-11-14T00:00:00Z'; },
  ]) {
    const candidate = receipt();
    edit(candidate);
    assert.throws(() => validateReleaseReport(candidate, env, now));
  }
});

test('backup manifest must list only fixed archive names and distinct valid SHA hashes', () => {
  assert.equal(validateBackupManifest(sums()).size, 2);
  for (const bad of [
    '',
    'invalid\n',
    'a'.repeat(64) + '  ../postgres.dump\n' + 'b'.repeat(64) + '  avatars.tar.gz\n',
    'a'.repeat(64) + ' *postgres.dump\n' + 'b'.repeat(64) + '  avatars.tar.gz\n',
    'a'.repeat(64) + '  postgres.dump\n' + 'b'.repeat(64) + '  postgres.dump\n',
    sums() + 'c'.repeat(64) + '  credentials.env\n',
    'a'.repeat(64) + '  postgres.dump\n' + 'z'.repeat(64) + '  avatars.tar.gz\n',
  ]) assert.throws(() => validateBackupManifest(bad));
});

test('reject symlinks, world/group-writable backup contents and missing archives', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'gym-operator-preflight-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await chmod(root, 0o700);
  const checksum = join(root, 'SHA256SUMS');
  const dump = join(root, 'postgres.dump');
  const avatar = join(root, 'avatars.tar.gz');
  await writeFile(checksum, sums(), { mode: 0o600 });
  await writeFile(dump, 'dummy-postgres', { mode: 0o600 });
  await writeFile(avatar, 'dummy-avatars', { mode: 0o600 });
  assert.equal((await inspectBackupDirectory(root)).size, 2);
  await chmod(avatar, 0o666);
  await assert.rejects(inspectBackupDirectory(root));
  await chmod(avatar, 0o600);
  await rm(avatar);
  await symlink(dump, avatar);
  await assert.rejects(inspectBackupDirectory(root));
  await assert.rejects(validatePrivateFile('relative.json'));
  await assert.rejects(validatePrivateFile(join(root, 'missing.json')));
});

test('private release report must match selected release and is never itself authorization', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'gym-release-preflight-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await chmod(root, 0o700);
  await writeFile(join(root, 'release.json'), JSON.stringify(receipt()), { mode: 0o600 });
  await writeFile(join(root, 'SHA256SUMS'), sums(), { mode: 0o600 });
  await writeFile(join(root, 'postgres.dump'), 'archive', { mode: 0o600 });
  await writeFile(join(root, 'avatars.tar.gz'), 'archive', { mode: 0o600 });
  const result = await checkEvidenceFiles({
    ...env, BACKUP_DIR: root, PRODUCTION_RELEASE_REPORT: join(root, 'release.json'),
  }, now);
  assert.equal(result.report.decision, 'NO-GO');
  assert.equal(result.report.productionReleaseApproval, false);
  await chmod(join(root, 'release.json'), 0o666);
  await assert.rejects(checkEvidenceFiles({
    ...env, BACKUP_DIR: root, PRODUCTION_RELEASE_REPORT: join(root, 'release.json'),
  }, now));
});

test('operator shell preflight is read-only, opt-in and refuses GitHub Actions', async () => {
  const shell = await readFile(new URL('./production-host-preflight.sh', import.meta.url), 'utf8');
  const ci = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(shell, /if \[\[ -n "\$\(printenv GITHUB_ACTIONS \|\| true\)" \]\]/);
  assert.match(shell, /node scripts\/production-host-preflight\.mjs evidence/);
  assert.match(shell, /sha256sum --check --status SHA256SUMS/);
  assert.match(shell, /pg_restore --list/);
  assert.match(shell, /tar -tzf/);
  assert.match(shell, /gh attestation verify/);
  assert.match(shell, /scripts\/production-digest-guard\.mjs (refs|images|compose|current)/);
  assert.match(shell, /--source-digest "\$PUBLISH_SHA"/);
  assert.match(shell, /NO-GO/);
  assert.ok(ci.includes('node --test scripts/production-host-preflight.test.mjs'));
  assert.ok(ci.includes('bash -n scripts/production-host-preflight.sh'));
  assert.doesNotMatch(shell, /^\s*(docker (pull|run|stop|build|push|restart|rm|volume)|.*\b(up -d|migrate deploy|db reset|docker compose up)\b)/m);
  assert.ok(!shell.includes('production-digest-deploy.sh'));
});
