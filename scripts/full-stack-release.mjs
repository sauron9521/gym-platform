#!/usr/bin/env node
// Separate pilot release contract; API-only v1 consumers stay unchanged.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveFingerprint } from './release-bundle.mjs';
import { targetAbsent, verifyRemoteImage } from './ghcr-promotion.mjs';
import { validateSpdx, validateGrype } from './release-supply-chain.mjs';

export const components = ['runtime', 'migrate', 'landing', 'web', 'trainer', 'admin'];
export const platform = 'linux/amd64';
export const profile = 'full-stack-pilot-noindex';
export const builder = '.github/workflows/release-full-stack.yml';
export const publisher = '.github/workflows/publish-full-stack-ghcr.yml';
export const baseImage =
  'node:24-trixie-slim@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5';
const sha = /^[a-f0-9]{40}$/;
const digest = /^sha256:[a-f0-9]{64}$/;
const runId = /^[1-9][0-9]{0,15}$/;
const repo = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const exact = (obj, keys) => assert.deepEqual(Object.keys(obj).sort(), [...keys].sort());
export function identity(repository, commit, run) {
  assert.match(repository, repo);
  assert.match(commit, sha);
  assert.match(run, runId);
  return { repository, commit, runId: run, ref: 'refs/heads/main', workflow: builder };
}
export function tags(source) {
  identity(source.repository, source.commit, source.runId);
  return Object.fromEntries(
    components.map((c) => [c, 'gym-full-stack-' + c + ':' + source.commit]),
  );
}
export function targets(source) {
  identity(source.repository, source.commit, source.runId);
  // Separate package namespace from the existing API-only promotion.
  return Object.fromEntries(
    components.map((c) => [
      c,
      'ghcr.io/' +
        source.repository.toLowerCase() +
        '-full-stack-' +
        c +
        ':sha-' +
        source.commit +
        '-run-' +
        source.runId,
    ]),
  );
}
export function validateRun(run, source) {
  assert.equal(String(run?.id), source.runId);
  assert.equal(run.repository?.full_name, source.repository);
  assert.equal(run.head_sha, source.commit);
  assert.equal(run.head_branch, 'main');
  assert.equal(run.event, 'workflow_dispatch');
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'success');
  assert.ok(
    [
      builder,
      source.repository + '/' + builder + '@refs/heads/main',
      source.repository + '/' + builder + '@main',
    ].includes(run.path),
  );
}
export function validateManifest(m, source) {
  exact(m, ['schemaVersion', 'source', 'platform', 'profile', 'baseImage', 'images', 'archive']);
  assert.equal(m.schemaVersion, 1);
  assert.deepEqual(m.source, source);
  assert.equal(m.platform, platform);
  assert.equal(m.profile, profile);
  assert.equal(m.baseImage, baseImage);
  exact(m.images, components);
  const expected = tags(source);
  for (const c of components) {
    exact(m.images[c], ['tag', 'id']);
    assert.equal(m.images[c].tag, expected[c]);
    assert.match(m.images[c].id, digest);
  }
  assert.equal(new Set(components.map((c) => m.images[c].id)).size, components.length);
  exact(m.archive, ['filename', 'sha256', 'bytes']);
  assert.equal(m.archive.filename, 'images.tar.gz');
  assert.match(m.archive.sha256, /^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(m.archive.bytes) && m.archive.bytes > 0);
  return m;
}
export function verifyImage(image, expected, source, component) {
  assert.equal(image.Id, expected.id);
  assert.equal(image.Config?.User, 'node');
  assert.equal(image.Os, 'linux');
  assert.equal(image.Architecture, 'amd64');
  assert.equal(image.Config?.Labels?.['org.opencontainers.image.revision'], source.commit);
  assert.equal(
    image.Config?.Labels?.['org.opencontainers.image.source'],
    'https://github.com/' + source.repository,
  );
  assert.equal(image.Config?.Labels?.['org.ovranto.release.component'], component);
  assert.equal(image.Config?.Labels?.['org.ovranto.release.profile'], profile);
}
export async function verifyArchive(m, path) {
  assert.deepEqual(await archiveFingerprint(path), {
    sha256: m.archive.sha256,
    bytes: m.archive.bytes,
  });
}
export function validateReceipt(receipt, m, manifestHash, publishSha, publishRun) {
  exact(receipt, [
    'schemaVersion',
    'source',
    'platform',
    'profile',
    'manifestSha256',
    'publication',
    'images',
  ]);
  assert.equal(receipt.schemaVersion, 1);
  assert.deepEqual(receipt.source, m.source);
  assert.equal(receipt.platform, platform);
  assert.equal(receipt.profile, profile);
  assert.match(manifestHash, /^[a-f0-9]{64}$/);
  assert.equal(receipt.manifestSha256, manifestHash);
  assert.match(publishSha, sha);
  assert.match(publishRun, runId);
  assert.deepEqual(receipt.publication, {
    commit: publishSha,
    runId: publishRun,
    workflow: publisher,
    ref: 'refs/heads/main',
  });
  exact(receipt.images, components);
  const expected = targets(m.source);
  for (const c of components) {
    exact(receipt.images[c], ['ref', 'id']);
    const parts = receipt.images[c].ref.split('@');
    assert.equal(parts.length, 2);
    assert.equal(parts[0], expected[c].split(':')[0]);
    assert.match(parts[1], digest);
    assert.equal(receipt.images[c].id, m.images[c].id);
  }
  assert.equal(
    new Set(components.map((c) => receipt.images[c].ref.split('@')[1])).size,
    components.length,
  );
  return receipt;
}
const inspect = (tag) =>
  JSON.parse(
    execFileSync('docker', ['image', 'inspect', tag, '--format', '{{json .}}'], {
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  );
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const save = (path, value) =>
  writeFile(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
async function main() {
  const [mode, repository, commit, run, dir, ...extra] = process.argv.slice(2);
  const source = identity(repository, commit, run);
  assert.ok(dir);
  const manifestPath = join(dir, 'manifest.json'),
    archive = join(dir, 'images.tar.gz');
  if (mode === 'validate-run') {
    assert.equal(extra.length, 1);
    validateRun(await json(extra[0]), source);
    return;
  }
  if (mode === 'create') {
    assert.equal(extra.length, 0);
    const images = Object.fromEntries(
      components.map((c) => {
        const tag = tags(source)[c];
        const img = inspect(tag);
        const expected = { tag, id: img.Id };
        verifyImage(img, expected, source, c);
        return [c, expected];
      }),
    );
    const m = validateManifest(
      {
        schemaVersion: 1,
        source,
        platform,
        profile,
        baseImage,
        images,
        archive: { filename: 'images.tar.gz', ...(await archiveFingerprint(archive)) },
      },
      source,
    );
    await save(manifestPath, m);
    return;
  }
  const m = validateManifest(await json(manifestPath), source);
  if (mode === 'verify') {
    assert.equal(extra.length, 0);
    await verifyArchive(m, archive);
    return;
  }
  if (mode === 'verify-images') {
    assert.equal(extra.length, 0);
    for (const c of components) verifyImage(inspect(m.images[c].tag), m.images[c], source, c);
    return;
  }
  if (mode === 'security') {
    assert.equal(extra.length, 0);
    const results = {};
    for (const c of components)
      results[c] = {
        sbom: validateSpdx(await json(join(dir, c + '.spdx.json'))),
        scan: validateGrype(await json(join(dir, c + '.grype.json'))),
      };
    await save(join(dir, 'security-summary.json'), results);
    return;
  }
  if (mode === 'preflight') {
    assert.equal(extra.length, 0);
    for (const tag of Object.values(targets(source)))
      await targetAbsent(tag, process.env.GITHUB_ACTOR, process.env.GH_TOKEN);
    return;
  }
  if (mode === 'receipt') {
    assert.equal(extra.length, 3);
    const [publishSha, publishRun, out] = extra;
    const images = {};
    for (const c of components) {
      const tag = targets(source)[c],
        img = inspect(tag);
      verifyImage(img, m.images[c], source, c);
      const ref = verifyRemoteImage(tag, m.images[c], source.commit, img);
      images[c] = { ref, id: img.Id };
    }
    const hash = (await archiveFingerprint(manifestPath)).sha256;
    const receipt = validateReceipt(
      {
        schemaVersion: 1,
        source,
        platform,
        profile,
        manifestSha256: hash,
        publication: {
          commit: publishSha,
          runId: publishRun,
          workflow: publisher,
          ref: 'refs/heads/main',
        },
        images,
      },
      m,
      hash,
      publishSha,
      publishRun,
    );
    await save(join(dir, 'receipt.json'), receipt);
    await appendFile(
      out,
      components
        .map((c) => {
          const [name, dig] = images[c].ref.split('@');
          return c + '_name=' + name + '\n' + c + '_digest=' + dig + '\n';
        })
        .join(''),
    );
    return;
  }
  if (mode === 'verify-receipt') {
    assert.equal(extra.length, 2);
    validateReceipt(
      await json(join(dir, 'receipt.json')),
      m,
      (await archiveFingerprint(manifestPath)).sha256,
      ...extra,
    );
    return;
  }
  throw new Error('Unsupported full stack release operation');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
    console.log('Full-stack release validation passed');
  } catch {
    console.error('Full-stack release validation failed');
    process.exitCode = 1;
  }
}
