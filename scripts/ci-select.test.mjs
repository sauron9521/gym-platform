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
    redis: false,
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

test('real API browser suite runs only for API, Web, shared client, or cross-cutting changes', () => {
  const cases = [
    { paths: ['apps/web/src/app/page.tsx'], run: true },
    { paths: ['apps/api/src/modules/users/users.service.ts'], run: true },
    { paths: ['packages/api-client/src/generated/schema.d.ts'], run: true },
    { paths: ['apps/api/openapi/openapi.json'], run: true },
    { paths: ['pnpm-lock.yaml'], run: true },
    { paths: ['.github/workflows/web-integration.yml'], run: true },
    { paths: ['apps/mobile/app/index.tsx'], run: false },
    { paths: ['README.md', 'docs/api/testing.md'], run: false },
    { paths: ['apps/mobile/app/index.tsx', 'apps/web/src/app/page.tsx'], run: true },
    { paths: [], run: true },
  ];

  for (const { paths, run } of cases) {
    const scope = classifyChangedPaths(paths);
    assert.equal(
      scope.full || scope.api || scope.web || scope.client,
      run,
      'Unexpected Web integration selection for ' + JSON.stringify(paths),
    );
  }

  assert.equal(selectFromGitHubEnvironment({ CI_FORCE_ALL: 'true' }).full, true);
});

test('real API browser suite preserves the required gate and fails closed', () => {
  const yaml = readFileSync(
    new URL('../.github/workflows/web-integration.yml', import.meta.url),
    'utf8',
  );
  assert.match(yaml, /name: Web \/ Real API and PostgreSQL suite/);
  assert.match(yaml, /name: Web \/ Real API and PostgreSQL\n/);
  assert.match(yaml, /needs: \[changes, browser-api-suite\]/);
  assert.match(yaml, /if: always\(\)/);
  assert.match(yaml, /if: needs\.changes\.outputs\.run == 'true'/);
  assert.match(yaml, /CI_FORCE_ALL:/);
  assert.match(yaml, /fetch-depth: 0/);
  assert.match(yaml, /test "\$CLASSIFY_RESULT" = success/);
  assert.match(yaml, /test "\$SUITE_RESULT" = success/);
  assert.match(yaml, /test "\$SUITE_RESULT" = skipped/);
});

test('dependency-security job is an enforced prerequisite of the protected Quality check', () => {
  const yaml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const quality = yaml.split('  quality:\n')[1]?.split('\n  api-coverage:\n')[0];
  const audit = yaml.split('  dependency-security:\n')[1]?.split('\n  api-operations:\n')[0];
  assert.ok(quality, 'Required Quality job must exist');
  assert.ok(audit, 'Dependency security job must exist');
  assert.match(
    quality,
    /needs: \[changes, prepush-windows, web-browser-e2e, dependency-security\]/,
  );
  assert.match(quality, /if: always\(\)/);
  assert.match(quality, /DEPS_REQUIRED: \$\{\{ needs\.changes\.outputs\.deps \}\}/);
  assert.match(quality, /SECURITY_RESULT: \$\{\{ needs\.dependency-security\.result \}\}/);
  assert.match(quality, /if \[ "\$DEPS_REQUIRED" = true \]; then/);
  assert.match(quality, /test "\$SECURITY_RESULT" = success/);
  assert.match(quality, /test "\$DEPS_REQUIRED" = false/);
  assert.match(quality, /test "\$SECURITY_RESULT" = skipped/);
  assert.match(audit, /if: needs\.changes\.outputs\.deps == 'true'/);
  assert.match(audit, /pnpm audit --prod --audit-level high/);
  assert.match(audit, /pnpm audit --audit-level critical/);
});

test('dependency audit runs for changed manifests and lockfile, not unrelated source files', () => {
  for (const path of [
    'apps/api/package.json',
    'apps/web/package.json',
    'apps/mobile/package.json',
    'packages/api-client/package.json',
    'package.json',
    'pnpm-lock.yaml',
    '.github/workflows/ci.yml',
  ]) {
    assert.equal(classifyChangedPaths([path]).deps, true, 'Missing audit: ' + path);
  }
  for (const path of [
    'apps/web/src/app/page.tsx',
    'apps/mobile/app/index.tsx',
    'docs/api/index.md',
  ]) {
    assert.equal(classifyChangedPaths([path]).deps, false, 'Unnecessary audit: ' + path);
  }
  assert.equal(selectFromGitHubEnvironment({ CI_FORCE_ALL: 'true' }).deps, true);
});

test('scheduled dependency audit checks newly disclosed vulnerabilities without app builds', () => {
  const yaml = readFileSync(
    new URL('../.github/workflows/dependency-audit.yml', import.meta.url),
    'utf8',
  );
  assert.match(yaml, /^name: Scheduled dependency audit/m);
  assert.match(yaml, /  schedule:/);
  assert.match(yaml, /  workflow_dispatch:/);
  assert.match(yaml, /    - cron: '17 4 \* \* 1'/);
  assert.match(yaml, /permissions:\n  contents: read/);
  assert.match(yaml, /pnpm audit --prod --audit-level high/);
  assert.match(yaml, /pnpm audit --audit-level critical/);
  assert.doesNotMatch(yaml, /pnpm install|pnpm build|pnpm test/);
});

test('Redis 7 to 8 migration check is selected only on relevant pull requests', () => {
  for (const path of [
    'infra/docker/compose.yaml',
    'scripts/test-redis-upgrade.sh',
    'scripts/ci-select.mjs',
    '.github/workflows/ci.yml',
  ]) {
    const selection = classifyChangedPaths([path]);
    assert.equal(selection.redis, true, 'Redis test not selected: ' + path);
    assert.equal(selection.full, true);
  }
  for (const path of ['apps/web/src/app/page.tsx', 'apps/api/src/main.ts', 'README.md']) {
    assert.equal(classifyChangedPaths([path]).redis, false);
  }
  assert.equal(classifyChangedPaths(['pnpm-lock.yaml']).redis, false);
  assert.equal(selectFromGitHubEnvironment({ CI_FORCE_ALL: 'true' }).redis, false);

  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const quality = workflow.split('  quality:\n')[1]?.split('\n  api-coverage:\n')[0];
  assert.ok(quality);
  assert.ok(workflow.includes('redis: $' + '{{ steps.select.outputs.redis }}'));
  assert.match(quality, /Rehearse isolated Redis 7 to Redis 8 AOF and backup recovery/);
  assert.ok(quality.includes("needs.changes.outputs.redis == 'true'"));
  assert.ok(quality.includes('run: bash scripts/test-redis-upgrade.sh'));
});

test('Redis migration rehearsal does not use real Compose volumes or downgrade in place', () => {
  const script = readFileSync(new URL('../scripts/test-redis-upgrade.sh', import.meta.url), 'utf8');
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /redis:7-alpine/);
  assert.match(script, /redis:8-alpine/);
  assert.match(script, /docker volume create/);
  assert.match(script, /BGREWRITEAOF/);
  assert.match(script, /redis7-data\.tar/);
  assert.match(script, /docker volume rm/);
  assert.doesNotMatch(script, /docker compose down|gym-platform-local_redis_data/);
});
