import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { archiveFingerprint } from './release-bundle.mjs';
import {
  components,
  identity,
  tags,
  targets,
  validateManifest,
  verifyImage,
  verifyArchive,
  validateReceipt,
  validateRun,
  platform,
  profile,
  baseImage,
  builder,
  publisher,
} from './full-stack-release.mjs';
const source = identity('sauron9521/gym-platform', 'a'.repeat(40), '123');
const publishSha = 'b'.repeat(40),
  publishRun = '456',
  manifestHash = 'c'.repeat(64);
const manifest = () => ({
  schemaVersion: 1,
  source,
  platform,
  profile,
  baseImage,
  images: Object.fromEntries(
    components.map((c, i) => [
      c,
      { tag: tags(source)[c], id: 'sha256:' + String(i + 1).repeat(64) },
    ]),
  ),
  archive: { filename: 'images.tar.gz', sha256: 'e'.repeat(64), bytes: 123 },
});
const receipt = (m) => ({
  schemaVersion: 1,
  source,
  platform,
  profile,
  manifestSha256: manifestHash,
  publication: {
    commit: publishSha,
    runId: publishRun,
    workflow: publisher,
    ref: 'refs/heads/main',
  },
  images: Object.fromEntries(
    components.map((c, i) => [
      c,
      {
        ref: targets(source)[c].split(':')[0] + '@sha256:' + String(i + 1).repeat(64),
        id: m.images[c].id,
      },
    ]),
  ),
});
const image = (m, c) => ({
  Id: m.images[c].id,
  Os: 'linux',
  Architecture: 'amd64',
  Config: {
    User: 'node',
    Labels: {
      'org.opencontainers.image.revision': source.commit,
      'org.opencontainers.image.source': 'https://github.com/' + source.repository,
      'org.ovranto.release.component': c,
      'org.ovranto.release.profile': profile,
    },
  },
});
test('exact six-component manifest rejects substitutions, duplicates, unknown fields and environment drift', () => {
  const m = manifest();
  assert.equal(validateManifest(m, source), m);
  for (const mutate of [
    (x) => delete x.images.admin,
    (x) => (x.images.extra = x.images.admin),
    (x) => (x.images.admin = x.images.trainer),
    (x) => (x.images.admin.id = x.images.trainer.id),
    (x) => (x.images.web.tag = 'latest'),
    (x) => (x.platform = 'linux/arm64'),
    (x) => (x.profile = 'production'),
    (x) => (x.source = { ...source, commit: 'f'.repeat(40) }),
    (x) => (x.baseImage = 'node:latest'),
    (x) => (x.archive.bytes = 0),
  ]) {
    const invalid = structuredClone(m);
    mutate(invalid);
    assert.throws(() => validateManifest(invalid, source));
  }
});
test('loaded image config, platform, source, component and profile must match', () => {
  const m = manifest();
  for (const c of components) verifyImage(image(m, c), m.images[c], source, c);
  for (const mutate of [
    (x) => (x.Id = 'sha256:' + 'f'.repeat(64)),
    (x) => (x.Architecture = 'arm64'),
    (x) => (x.Config.User = 'root'),
    (x) => (x.Config.Labels['org.ovranto.release.component'] = 'admin'),
    (x) => (x.Config.Labels['org.ovranto.release.profile'] = 'production'),
    (x) => (x.Config.Labels['org.opencontainers.image.source'] = 'https://github.com/other/repo'),
  ]) {
    const bad = image(m, 'web');
    mutate(bad);
    assert.throws(() => verifyImage(bad, m.images.web, source, 'web'));
  }
});
test('archive tamper is rejected even when byte length is unchanged', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'full-stack-release-test-'));
  try {
    const path = join(dir, 'images.tar.gz');
    await writeFile(path, 'original');
    const m = manifest();
    m.archive = { filename: 'images.tar.gz', ...(await archiveFingerprint(path)) };
    await verifyArchive(m, path);
    await writeFile(path, 'tampered');
    await assert.rejects(verifyArchive(m, path));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('receipt binds all exact registry namespaces, image IDs, manifest hash and publisher identity', () => {
  const m = manifest(),
    r = receipt(m);
  assert.equal(validateReceipt(r, m, manifestHash, publishSha, publishRun), r);
  for (const mutate of [
    (x) => delete x.images.admin,
    (x) => (x.images.extra = x.images.web),
    (x) => (x.images.admin.ref = targets(source).admin),
    (x) => (x.images.admin.ref = x.images.trainer.ref),
    (x) => (x.images.admin.id = x.images.web.id),
    (x) => (x.images.admin.ref = x.images.admin.ref.replace('sauron9521', 'other')),
    (x) =>
      (x.images.admin.ref =
        x.images.admin.ref.split('@')[0] + '@' + x.images.web.ref.split('@')[1]),
    (x) => (x.manifestSha256 = 'f'.repeat(64)),
    (x) => (x.publication.commit = source.commit),
    (x) => (x.publication.runId = '999'),
    (x) => (x.profile = 'production'),
  ]) {
    const bad = structuredClone(r);
    mutate(bad);
    assert.throws(() => validateReceipt(bad, m, manifestHash, publishSha, publishRun));
  }
});
test('only completed manual full-stack main release run is eligible', () => {
  const r = {
    id: 123,
    repository: { full_name: source.repository },
    head_sha: source.commit,
    head_branch: 'main',
    event: 'workflow_dispatch',
    status: 'completed',
    conclusion: 'success',
    path: builder,
  };
  validateRun(r, source);
  for (const bad of [
    { ...r, path: '.github/workflows/release-artifacts.yml' },
    { ...r, head_branch: 'feature' },
    { ...r, conclusion: 'failure' },
    { ...r, event: 'push' },
    { ...r, id: 456 },
  ])
    assert.throws(() => validateRun(bad, source));
});
test('manual workflows enforce exact source, all scans before push, signatures and complete receipt', async () => {
  const build = await readFile(new URL('../' + builder, import.meta.url), 'utf8'),
    publish = await readFile(new URL('../' + publisher, import.meta.url), 'utf8');
  for (const s of [build, publish]) {
    assert.match(s, /^on:\n  workflow_dispatch:/m);
    assert.doesNotMatch(s, /^\s+(push|pull_request|schedule):/m);
    assert.match(s, /github\.ref == 'refs\/heads\/main'/);
    assert.match(s, /release-ci-gate\.mjs/);
    assert.match(s, /persist-credentials: false/);
    assert.doesNotMatch(s, /docker compose|gh release create/);
  }
  assert.ok(build.includes(baseImage));
  assert.doesNotMatch(build, /docker push|packages: write/);
  assert.match(build, /docker load/);
  assert.match(build, /--source-digest/);
  assert.match(publish, /default: NO_PUBLISH/);
  assert.match(publish, /PUBLISH_VERIFIED_FULL_STACK_PILOT/);
  assert.doesNotMatch(publish, /docker build/);
  const push = publish.indexOf('docker push');
  for (const c of components) {
    assert.ok(publish.indexOf('Scan ' + c + ' for critical vulnerabilities') < push);
    assert.ok(publish.includes('sbom-path: release/' + c + '.spdx.json'));
    assert.ok(publish.includes('steps.published.outputs.' + c + '_digest'));
  }
  assert.equal((publish.match(/severity-cutoff: critical/g) || []).length, 6);
  assert.equal((publish.match(/fail-build: true/g) || []).length, 6);
  assert.equal((publish.match(/push-to-registry: true/g) || []).length, 12);
  assert.ok(publish.indexOf('preflight') < push);
  assert.match(publish, /--predicate-type/);
  assert.match(publish, /subject-path: release\/receipt.json/);
  assert.ok(
    publish.indexOf('Verify signed receipt') < publish.indexOf('Preserve complete signed receipt'),
  );
});
