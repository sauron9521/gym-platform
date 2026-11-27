// Manual runner: verify exact successful builder/publisher runs, signed files
// and OCI attestations before any container or migration is created.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveFingerprint } from './release-bundle.mjs';
import { requireGreenMainCi } from './release-ci-gate.mjs';
import {
  components,
  identity,
  publisher,
  builder,
  validateRun,
  validateManifest,
  validateReceipt,
  verifyImage,
} from './full-stack-release.mjs';
import { runFullStackRehearsal } from './full-stack-rehearsal.mjs';

export function validatePublisherRun(run, repository, commit, id) {
  identity(repository, commit, id);
  assert.equal(String(run?.id), id);
  assert.equal(run.repository?.full_name, repository);
  assert.equal(run.head_sha, commit);
  assert.equal(run.head_branch, 'main');
  assert.equal(run.event, 'workflow_dispatch');
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'success');
  assert.ok(
    [
      publisher,
      repository + '/' + publisher + '@refs/heads/main',
      repository + '/' + publisher + '@main',
    ].includes(run.path),
  );
}
export function validateRequest(env) {
  assert.equal(env.GITHUB_REF, 'refs/heads/main');
  assert.equal(env.CONFIRM_STAGING, 'RUN_SIGNED_FULL_STACK_REHEARSAL');
  const source = identity(env.GITHUB_REPOSITORY, env.SOURCE_SHA, env.RELEASE_RUN_ID);
  identity(source.repository, env.PUBLISH_SHA, env.PUBLISH_RUN_ID);
  assert.notEqual(source.runId, env.PUBLISH_RUN_ID);
  return { source, publishSha: env.PUBLISH_SHA, publishRun: env.PUBLISH_RUN_ID };
}
const call = (command, args) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    timeout: 180000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const gh = (...args) => call('gh', args);
const docker = (...args) => call('docker', args);
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
async function main() {
  const { source, publishSha, publishRun } = validateRequest(process.env);
  const repository = source.repository;
  const dir = mkdtempSync(join(tmpdir(), 'signed-full-stack-'));
  try {
    validateRun(
      JSON.parse(gh('api', 'repos/' + repository + '/actions/runs/' + source.runId)),
      source,
    );
    validatePublisherRun(
      JSON.parse(gh('api', 'repos/' + repository + '/actions/runs/' + publishRun)),
      repository,
      publishSha,
      publishRun,
    );
    requireGreenMainCi(
      JSON.parse(
        gh(
          'api',
          'repos/' +
            repository +
            '/actions/workflows/ci.yml/runs?head_sha=' +
            source.commit +
            '&branch=main&event=push&per_page=100',
        ),
      ),
      repository,
      source.commit,
    );
    gh(
      'run',
      'download',
      publishRun,
      '--repo',
      repository,
      '--name',
      'full-stack-digests-' + source.commit + '-' + source.runId,
      '--dir',
      dir,
    );
    const manifestPath = join(dir, 'manifest.json'),
      receiptPath = join(dir, 'receipt.json');
    const attest = (subject, workflow, commit, predicate) =>
      gh(
        'attestation',
        'verify',
        subject,
        '--repo',
        repository,
        '--signer-workflow',
        repository + '/' + workflow,
        '--source-ref',
        'refs/heads/main',
        '--source-digest',
        commit,
        '--predicate-type',
        predicate,
      );
    attest(manifestPath, builder, source.commit, 'https://slsa.dev/provenance/v1');
    attest(receiptPath, publisher, publishSha, 'https://slsa.dev/provenance/v1');
    const manifest = validateManifest(json(manifestPath), source);
    const receipt = validateReceipt(
      json(receiptPath),
      manifest,
      (await archiveFingerprint(manifestPath)).sha256,
      publishSha,
      publishRun,
    );
    // All signatures must pass before the first pull, all image identities before migration.
    for (const c of components) {
      for (const predicate of ['https://slsa.dev/provenance/v1', 'https://spdx.dev/Document/v2.3'])
        attest('oci://' + receipt.images[c].ref, publisher, publishSha, predicate);
    }
    for (const c of components) {
      const ref = receipt.images[c].ref;
      docker('pull', '--platform', 'linux/amd64', ref);
      const image = JSON.parse(docker('image', 'inspect', ref, '--format', '{{json .}}'));
      assert.ok(image.RepoDigests.includes(ref));
      verifyImage(image, manifest.images[c], source, c);
    }
    console.log('Signed full-stack receipt and all six OCI identities verified');
    await runFullStackRehearsal({ signedImages: receipt.images });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch {
    console.error('Signed full-stack staging rehearsal failed');
    process.exitCode = 1;
  }
}
