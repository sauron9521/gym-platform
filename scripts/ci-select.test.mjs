import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { classifyChangedPaths, selectFromGitHubEnvironment } from './ci-select.mjs';

test('Web-only change skips API E2E, Docker and Mobile', () => {
  assert.deepEqual(classifyChangedPaths(['apps/web/src/app/page.tsx']), {
    full: false,
    api: false,
    web: true,
    mobile: false,
    client: false,
    deps: false,
    workspaces: true,
  });
});

test('Mobile-only change skips API E2E and Web', () => {
  const actual = classifyChangedPaths(['apps/mobile/app/index.tsx']);
  assert.equal(actual.api, false);
  assert.equal(actual.web, false);
  assert.equal(actual.mobile, true);
  assert.equal(actual.full, false);
});

test('API change triggers API verification but not Web or Mobile builds', () => {
  const actual = classifyChangedPaths(['apps/api/src/modules/users/users.service.ts']);
  assert.equal(actual.api, true);
  assert.equal(actual.web, false);
  assert.equal(actual.mobile, false);
  assert.equal(actual.deps, false);
});

test('shared API client triggers both frontends without API E2E', () => {
  const actual = classifyChangedPaths(['packages/api-client/src/generated/schema.d.ts']);
  assert.equal(actual.client, true);
  assert.equal(actual.web, true);
  assert.equal(actual.mobile, true);
  assert.equal(actual.api, false);
});

test('committed OpenAPI contract triggers API and both consumers', () => {
  const actual = classifyChangedPaths(['apps/api/openapi/openapi.json']);
  assert.equal(actual.api, true);
  assert.equal(actual.client, true);
  assert.equal(actual.web, true);
  assert.equal(actual.mobile, true);
});

test('app-local manifest changes trigger vulnerability audit', () => {
  const actual = classifyChangedPaths(['apps/web/package.json']);
  assert.equal(actual.api, false);
  assert.equal(actual.web, true);
  assert.equal(actual.deps, true);
});

test('docs-only PR still runs required quality gate and formatting', () => {
  const actual = classifyChangedPaths(['README.md', 'docs/api/testing.md']);
  assert.equal(actual.full, false);
  assert.equal(actual.workspaces, false);
  assert.equal(actual.deps, false);
});

test('root dependencies and cross-cutting changes force full regression', () => {
  for (const file of [
    'pnpm-lock.yaml',
    'package.json',
    'pnpm-workspace.yaml',
    'turbo.json',
    '.github/workflows/ci.yml',
    'infra/docker/compose.yaml',
    'scripts/ci-select.mjs',
    'packages/some-new-package/src/index.ts',
  ]) {
    const actual = classifyChangedPaths(['apps/web/src/page.tsx', file]);
    assert.equal(actual.full, true, 'Must force full CI: ' + file);
    assert.equal(actual.api, true);
    assert.equal(actual.mobile, true);
    assert.equal(actual.deps, true);
  }
});

test('empty, malformed and escaped paths fail closed', () => {
  for (const files of [[], [''], ['../../foo'], ['/tmp/evil']]) {
    assert.equal(classifyChangedPaths(files).full, true);
  }
});

test('main pushes and manual dispatch always use full regression', () => {
  const actual = selectFromGitHubEnvironment({ CI_FORCE_ALL: 'true' });
  assert.equal(actual.full, true);
  assert.equal(actual.api, true);
  assert.equal(actual.web, true);
  assert.equal(actual.mobile, true);
});

test('invalid PR comparison refs fail rather than skip API E2E', () => {
  for (const env of [
    { CI_FORCE_ALL: 'false' },
    { CI_FORCE_ALL: 'false', CI_BASE_SHA: 'main', CI_HEAD_SHA: 'head' },
  ]) {
    assert.throws(() => selectFromGitHubEnvironment(env));
  }
});

test('branch protection names stay stable and API E2E is a real gate', () => {
  const yaml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(yaml, /name: Quality \/ Node 24/);
  assert.match(yaml, /name: API e2e \/ PostgreSQL 17/);
  assert.match(yaml, /name: API e2e suite \/ PostgreSQL 17/);
  assert.match(yaml, /needs: \[changes, api-e2e-suite, api-coverage\]/);
  assert.match(yaml, /CI_FORCE_ALL:/);
});

test('API coverage replaces duplicate API unit tests without weakening required checks', () => {
  const yaml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const turbo = JSON.parse(readFileSync(new URL('../turbo.json', import.meta.url), 'utf8'));

  assert.equal(turbo.tasks.test.cache, false);
  assert.match(yaml, /run: pnpm --filter @gym\/api test:cov/);
  assert.match(
    yaml,
    /pnpm exec turbo run test --filter=@gym\/web --filter=@gym\/mobile --filter=@gym\/api-client/,
  );
  assert.doesNotMatch(yaml, /pnpm exec turbo run test "\$\{filters\[@\]\}"/);
  assert.match(yaml, /needs: \[changes, api-e2e-suite, api-coverage\]/);
  assert.match(yaml, /COVERAGE_RESULT: \$\{\{ needs\.api-coverage\.result \}\}/);
  assert.match(yaml, /test "\$COVERAGE_RESULT" = success/);
  assert.match(yaml, /test "\$COVERAGE_RESULT" = skipped/);
});

test('CI caches only reusable build artifacts and not test or secret outputs', () => {
  const yaml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const cacheBlock = yaml
    .split('      - name: Restore Turborepo and Next.js incremental build caches')[1]
    ?.split('      - name: Install dependencies')[0];
  assert.ok(cacheBlock);
  assert.match(cacheBlock, /uses: actions\/cache@v6/);
  assert.match(cacheBlock, /\.turbo\/cache/);
  assert.match(cacheBlock, /apps\/web\/\.next\/cache/);
  assert.match(cacheBlock, /hashFiles\('pnpm-lock\.yaml', 'turbo\.json'/);
  const paths = cacheBlock.split('path: |')[1]?.split('key:')[0];
  assert.ok(paths);
  assert.doesNotMatch(paths, /node_modules|coverage\/|\.env|\.pem|secrets/);
});
