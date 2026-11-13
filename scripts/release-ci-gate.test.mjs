import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { requireGreenMainCi } from './release-ci-gate.mjs';

const repository = 'sauron9521/gym-platform';
const sha = 'abcdef0123456789abcdef0123456789abcdef01';
const good = {
  id: 123,
  repository: { full_name: repository },
  head_sha: sha,
  head_branch: 'main',
  event: 'push',
  status: 'completed',
  conclusion: 'success',
};

test('release gate accepts exact-commit successful main push CI', () => {
  assert.deepEqual(requireGreenMainCi({ workflow_runs: [good] }, repository, sha), {
    runId: 123,
    sourceSha: sha,
    verified: true,
  });
});

test('release gate rejects invalid or absent source-commit CI', () => {
  const changes = [
    { repository: { full_name: 'another/repository' } },
    { head_sha: 'f'.repeat(40) },
    { head_branch: 'feature' },
    { event: 'workflow_dispatch' },
    { event: 'pull_request' },
    { status: 'in_progress' },
    { conclusion: 'failure' },
    { conclusion: 'cancelled' },
    { id: 0 },
  ];

  for (const change of changes) {
    assert.throws(
      () => requireGreenMainCi({ workflow_runs: [{ ...good, ...change }] }, repository, sha),
    );
  }
  assert.throws(() => requireGreenMainCi({ workflow_runs: [] }, repository, sha));
  assert.throws(() => requireGreenMainCi({ workflow_runs: [good] }, '../evil', sha));
  assert.throws(() => requireGreenMainCi({ workflow_runs: [good] }, repository, 'main'));
});

test('more recent failure blocks release even when older CI passed', () => {
  const payload = {
    workflow_runs: [
      good,
      { ...good, id: 124, conclusion: 'failure' },
      { ...good, id: 125, event: 'pull_request' },
    ],
  };
  assert.throws(() => requireGreenMainCi(payload, repository, sha));
  assert.equal(
    requireGreenMainCi(
      { workflow_runs: [{ ...good, id: 124 }, { ...good, id: 123, conclusion: 'failure' }] },
      repository,
      sha,
    ).runId,
    124,
  );
});

test('both manual workflows verify exact main CI without exposing registry write to PRs', async () => {
  for (const path of ['release-artifacts.yml', 'publish-ghcr.yml']) {
    const source = await readFile(new URL('../.github/workflows/' + path, import.meta.url), 'utf8');
    assert.match(source, /^on:\n  workflow_dispatch:/m);
    assert.match(source, /github\.ref == 'refs\/heads\/main'/);
    assert.match(source, /actions\/workflows\/ci\.yml\/runs\?head_sha=/);
    assert.match(source, /node scripts\/release-ci-gate\.mjs/);
    assert.doesNotMatch(source, /^\s+(push|pull_request|schedule):/m);
  }

  const release = await readFile(
    new URL('../.github/workflows/release-artifacts.yml', import.meta.url),
    'utf8',
  );
  const publish = await readFile(
    new URL('../.github/workflows/publish-ghcr.yml', import.meta.url),
    'utf8',
  );
  assert.match(release, /node:24-trixie-slim/);
  assert.match(release, /-f apps\/api\/Dockerfile --target runtime/);
  assert.match(release, /-f apps\/api\/Dockerfile --target migrate/);
  assert.match(publish, /PUBLISH_VERIFIED_CANDIDATE/);
  assert.match(publish, /gh attestation verify/);
  assert.doesNotMatch(release, /packages: write|docker push|gh release create/);
  assert.doesNotMatch(publish, /docker build|docker compose|gh release create/);
});
