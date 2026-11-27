import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { validatePublisherRun, validateRequest } from './full-stack-signed-staging.mjs';
import { edgeConfig, routes } from './full-stack-staging-edge.mjs';
import { publisher } from './full-stack-release.mjs';

const env = {
  GITHUB_REF: 'refs/heads/main',
  CONFIRM_STAGING: 'RUN_SIGNED_FULL_STACK_REHEARSAL',
  GITHUB_REPOSITORY: 'sauron9521/gym-platform',
  SOURCE_SHA: 'a'.repeat(40),
  RELEASE_RUN_ID: '123',
  PUBLISH_SHA: 'b'.repeat(40),
  PUBLISH_RUN_ID: '456',
};
const run = {
  id: 456,
  repository: { full_name: env.GITHUB_REPOSITORY },
  head_sha: env.PUBLISH_SHA,
  head_branch: 'main',
  event: 'workflow_dispatch',
  status: 'completed',
  conclusion: 'success',
  path: publisher,
};
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('signed staging requires explicit authorization and distinct successful source and publisher runs', () => {
  const request = validateRequest(env);
  assert.equal(request.source.runId, '123');
  assert.equal(request.publishRun, '456');
  for (const change of [
    { CONFIRM_STAGING: 'NO_STAGING_RUN' },
    { GITHUB_REF: 'refs/heads/feature' },
    { SOURCE_SHA: 'latest' },
    { PUBLISH_RUN_ID: '123' },
    { PUBLISH_SHA: 'bad' },
    { RELEASE_RUN_ID: '0' },
  ])
    assert.throws(() => validateRequest({ ...env, ...change }));
  validatePublisherRun(run, env.GITHUB_REPOSITORY, env.PUBLISH_SHA, '456');
  for (const change of [
    { id: 123 },
    { head_sha: env.SOURCE_SHA },
    { head_branch: 'feature' },
    { event: 'push' },
    { status: 'in_progress' },
    { conclusion: 'failure' },
    { path: '.github/workflows/publish-ghcr.yml' },
    { repository: { full_name: 'other/repo' } },
  ])
    assert.throws(() =>
      validatePublisherRun({ ...run, ...change }, env.GITHUB_REPOSITORY, env.PUBLISH_SHA, '456'),
    );
});
test('staging verifies attestations and every digest before any migration, never builds signed images', () => {
  const script = read('scripts/full-stack-signed-staging.mjs');
  const rehearsal = read('scripts/full-stack-rehearsal.mjs');
  const order = [
    script.indexOf('    validatePublisherRun('),
    script.indexOf("'download',"),
    script.indexOf('const receipt = validateReceipt('),
    script.indexOf("docker('pull'"),
    script.indexOf('verifyImage(image'),
    script.indexOf('await runFullStackRehearsal('),
  ];
  assert.ok(
    order.every((position, index) => position >= 0 && (index === 0 || position > order[index - 1])),
  );
  assert.match(script, /https:\/\/spdx.dev\/Document\/v2.3/);
  assert.match(script, /--source-digest/);
  assert.match(rehearsal, /if \(!signedImages\) compose\('--profile', 'ops', 'build'/);
  assert.match(rehearsal, /build: !reset null/);
  assert.match(rehearsal, /Signed service cannot rebuild/);
  assert.match(rehearsal, /if \(!signedImages\)/);
  assert.match(rehearsal, /No direct digest overrides allowed/);
});
test('TLS edge has only five synthetic hosts, no external certificates, and Redis failure checks', () => {
  assert.equal(Object.keys(routes).length, 5);
  assert.deepEqual(Object.values(routes), ['landing', 'web', 'trainer', 'admin', 'api']);
  const config = edgeConfig();
  assert.match(config, /local_certs/);
  assert.match(config, /strict_sni_host on/);
  assert.equal((config.match(/respond @private 404/g) || []).length, 5);
  assert.doesNotMatch(config, /ovranto\.com|trusted_proxies/);
  const edge = read('scripts/full-stack-staging-edge.mjs');
  assert.match(edge, /compose\('stop', 'redis'\)/);
  assert.match(edge, /mode==='redis-down'\?503:200/);
  assert.doesNotMatch(edge, /--publish|--network', 'host'|NODE_TLS_REJECT_UNAUTHORIZED/);
});
test('manual staging workflow is read only and not a deployment trigger', () => {
  const wf = read('.github/workflows/staging-full-stack.yml');
  assert.match(wf, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(wf, /^\s+(push|pull_request|schedule):/m);
  assert.match(wf, /default: NO_STAGING_RUN/);
  assert.match(wf, /packages: read/);
  assert.match(wf, /attestations: read/);
  assert.doesNotMatch(wf, /packages: write|id-token: write|docker push|environment: production/);
  assert.match(wf, /node scripts\/full-stack-signed-staging.mjs/);
});
