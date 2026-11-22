import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import { classifyChangedPaths, selectFromGitHubEnvironment } from './ci-select.mjs';

test('workspace quality executes independently before long integration suites finish', () => {
  const yaml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const checks = yaml.split('  quality-workspaces:\n')[1]?.split('\n  quality:\n')[0];
  const gate = yaml.split('  quality:\n')[1]?.split('\n  api-coverage:\n')[0];
  assert.ok(checks, 'Workspace quality job missing');
  assert.ok(gate, 'Required Quality gate missing');
  assert.match(checks, /name: Quality workspaces \/ Node 24/);
  assert.match(checks, /needs: changes/);
  assert.match(checks, /pnpm format:check/);
  assert.match(checks, /pnpm build/);
  assert.doesNotMatch(checks, /needs: \[.*web-browser-e2e/);
  assert.match(gate, /test "\$QUALITY_WORKSPACES_RESULT" = success/);
  assert.doesNotMatch(gate, /pnpm install --frozen-lockfile/);
});

test('Web-only change skips API E2E, Docker and Mobile', () => {
  assert.deepEqual(classifyChangedPaths(['apps/web/src/app/page.tsx']), {
    full: false,
    api: false,
    web: true,
    landing: false,
    admin: false,
    trainer: false,
    mobile: false,
    client: false,
    deps: false,
    workspaces: true,
    redis: false,
  });
});

test('Landing-only changes check landing without requiring API or Web browser suites', () => {
  assert.deepEqual(classifyChangedPaths(['apps/landing/src/app/page.tsx']), {
    full: false,
    api: false,
    web: false,
    landing: true,
    admin: false,
    trainer: false,
    mobile: false,
    client: false,
    deps: false,
    workspaces: true,
    redis: false,
  });

  const manifest = classifyChangedPaths(['apps/landing/package.json']);
  assert.equal(manifest.landing, true);
  assert.equal(manifest.deps, true);
  assert.equal(manifest.web, false);
});

test('Admin-only changes select Admin without unrelated API E2E', () => {
  const selected = classifyChangedPaths(['apps/admin/src/app/page.tsx']);
  assert.equal(selected.admin, true);
  assert.equal(selected.api, false);
  assert.equal(selected.web, false);
  assert.equal(selected.full, false);
  assert.equal(classifyChangedPaths(['apps/admin/package.json']).deps, true);
});

test('Trainer-only changes select only Trainer, while its manifest opts into security audit', () => {
  const selected = classifyChangedPaths(['apps/trainer/src/app/page.tsx']);
  assert.equal(selected.trainer, true);
  assert.equal(selected.full, false);
  assert.equal(selected.api, false);
  assert.equal(selected.web, false);
  assert.equal(selected.admin, false);
  assert.equal(selected.mobile, false);
  assert.equal(classifyChangedPaths(['apps/trainer/package.json']).deps, true);
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
  assert.equal(actual.admin, true);
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

test('known shared packages select consumers and avoid unrelated API E2E', () => {
  for (const [path, mobile] of [
    ['packages/ui-web/src/button.tsx', false],
    ['packages/design-tokens/src/dark.css', true],
    ['tooling/config/eslint-next.mjs', false],
    ['tooling/config/tsconfig-next.json', false],
  ]) {
    assert.deepEqual(classifyChangedPaths([path]), {
      full: false,
      api: false,
      web: true,
      landing: true,
      admin: true,
      trainer: true,
      mobile,
      client: false,
      deps: false,
      workspaces: true,
      redis: false,
    });
  }
});

test('shared locale changes select API mail and all UI consumers', () => {
  for (const locale of ['uk', 'en']) {
    const source = classifyChangedPaths([`packages/i18n/src/messages/${locale}.json`]);
    assert.deepEqual(source, {
      full: false,
      api: true,
      web: true,
      landing: true,
      admin: true,
      trainer: true,
      mobile: true,
      client: false,
      deps: false,
      workspaces: true,
      redis: false,
    });
  }

  const docs = classifyChangedPaths(['packages/i18n/README.md']);
  assert.equal(docs.trainer, true);
  assert.equal(docs.full, false);

  const manifest = classifyChangedPaths(['packages/i18n/package.json']);
  assert.equal(manifest.full, false);
  assert.equal(manifest.deps, true);
  assert.equal(manifest.api, true);
  assert.equal(manifest.trainer, true);
});

test('Trainer-only changes validate the shared locale package', () => {
  const selected = classifyChangedPaths(['apps/trainer/src/i18n/request.ts']);
  assert.equal(selected.trainer, true);
  assert.equal(selected.api, false);
  assert.equal(selected.full, false);

  const yaml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(
    yaml,
    /if \[ "\$CI_TRAINER" = true \]; then filters\+=\(--filter=@gym\/trainer\); fi/,
  );
  assert.match(yaml, /\|\| \[ "\$CI_TRAINER" = true \].*filters\+=\(--filter=@gym\/i18n\)/);
});

test('shared package manifests require dependency vulnerability audits', () => {
  for (const path of ['packages/ui-web/package.json', 'packages/design-tokens/package.json']) {
    const result = classifyChangedPaths([path]);
    assert.equal(result.full, false);
    assert.equal(result.deps, true);
    assert.equal(result.web, true);
    assert.equal(result.landing, true);
    assert.equal(result.api, false);
  }
});

test('mixed shared changes union scopes and unknown dependencies fail closed', () => {
  const mixed = classifyChangedPaths([
    'packages/ui-web/src/button.tsx',
    'tooling/config/tsconfig-next.json',
    'apps/mobile/app/index.tsx',
  ]);
  assert.equal(mixed.full, false);
  assert.equal(mixed.web, true);
  assert.equal(mixed.landing, true);
  assert.equal(mixed.mobile, true);
  assert.equal(mixed.api, false);
  assert.equal(mixed.deps, false);

  for (const path of [
    'packages/new-package/src/index.ts',
    'packages/new-package/package.json',
    'tooling/config/package.json',
    'pnpm-lock.yaml',
  ]) {
    const result = classifyChangedPaths([path]);
    assert.equal(result.full, true, path);
    assert.equal(result.api, true, path);
    assert.equal(result.deps, true, path);
  }
});

test('Admin is included for all shared packages it consumes', () => {
  for (const path of [
    'packages/ui-web/src/button.tsx',
    'packages/design-tokens/src/dark.css',
    'packages/api-client/src/index.ts',
    'tooling/config/eslint-next.mjs',
  ]) {
    const actual = classifyChangedPaths([path]);
    assert.equal(actual.admin, true, path);
    assert.equal(actual.full, false, path);
  }
});

test('affected Web quality also typechecks the shared UI workspace', () => {
  const yaml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const workspaces = yaml.split('  quality-workspaces:\n')[1]?.split('\n  quality:\n')[0];
  assert.ok(workspaces);
  assert.match(
    workspaces,
    /if \[ "\$CI_WEB" = true \]; then filters\+=\(--filter=@gym\/ui-web\); fi/,
  );
});

test('docs-only PR still runs required quality gate and formatting', () => {
  const actual = classifyChangedPaths(['README.md', 'docs/api/testing.md']);
  assert.equal(actual.full, false);
  assert.equal(actual.workspaces, false);
  assert.equal(actual.deps, false);
});

test('application handbooks and nested infrastructure Markdown skip expensive PR jobs', () => {
  const paths = [
    'README.md',
    'docs/api/testing.md',
    'apps/api/README.md',
    'apps/api/test/README.md',
    'apps/web/README.md',
    'apps/trainer/README.md',
    'apps/landing/README.md',
    'apps/mobile/README.md',
    'packages/api-client/README.md',
    'infra/docker/README.md',
    'infra/docker/production/README.md',
    'infra/new-component/guide.md',
  ];
  const actual = classifyChangedPaths(paths);
  assert.deepEqual(actual, {
    full: false,
    api: false,
    web: false,
    landing: false,
    admin: false,
    trainer: false,
    mobile: false,
    client: false,
    deps: false,
    workspaces: false,
    redis: false,
  });

  assert.deepEqual(classifyChangedPaths(['infra\\docker\\README.md']), actual);
});

test('documentation changes never override real affected workspace checks', () => {
  const docs = ['apps/api/README.md', 'apps/web/README.md', 'infra/docker/README.md'];

  const api = classifyChangedPaths([...docs, 'apps/api/src/main.ts']);
  assert.equal(api.api, true);
  assert.equal(api.full, false);
  assert.equal(api.web, false);
  assert.equal(api.deps, false);

  const web = classifyChangedPaths([...docs, 'apps/web/src/app/page.tsx']);
  assert.equal(web.api, false);
  assert.equal(web.web, true);
  assert.equal(web.full, false);

  const infra = classifyChangedPaths([...docs, 'infra/docker/compose.yaml']);
  assert.equal(infra.full, true);
  assert.equal(infra.api, true);
  assert.equal(infra.web, true);
  assert.equal(infra.deps, true);
  assert.equal(infra.redis, true);
});

test('non-Markdown infrastructure, manifests, CI and unknown Markdown fail closed', () => {
  for (const path of [
    'infra/docker/compose.yaml',
    'infra/docker/.env.example',
    'infra/docker/init/01-create-test-db.sh',
    'infra/docker/production/compose.prod.yaml',
    'packages/unknown/README.md',
    'scripts/README.md',
    '.github/README.md',
    '.github/workflows/ci.yml',
    'infra/docker/readme.MD',
  ]) {
    const actual = classifyChangedPaths(['infra/docker/README.md', path]);
    assert.equal(actual.full, true, 'Expected full CI for ' + path);
    assert.equal(actual.api, true);
    assert.equal(actual.deps, true);
  }

  const sourceMarkdown = classifyChangedPaths([
    'infra/docker/README.md',
    'apps/api/src/modules/auth/README.md',
  ]);
  assert.equal(sourceMarkdown.full, false);
  assert.equal(sourceMarkdown.api, true);
  assert.equal(sourceMarkdown.web, false);

  const manifest = classifyChangedPaths(['infra/docker/README.md', 'apps/api/package.json']);
  assert.equal(manifest.full, false);
  assert.equal(manifest.api, true);
  assert.equal(manifest.deps, true);
  assert.equal(manifest.web, false);

  for (const invalid of [
    ['infra/../docker/README.md'],
    ['/infra/docker/README.md'],
    ['infra/docker/README.md', ''],
    ['infra/docker/README.md', null],
  ]) {
    assert.equal(classifyChangedPaths(invalid).full, true);
  }
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

test('PostgreSQL E2E is split across isolated runners and all shards remain required', () => {
  const yaml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const suite = yaml.split('  api-e2e-suite:\n')[1]?.split('\n  api-e2e:\n')[0];
  const gate = yaml.split('  api-e2e:\n')[1];
  assert.ok(suite);
  assert.ok(gate);
  assert.match(suite, /strategy:\n\s+fail-fast: false\n\s+matrix:\n\s+shard: \[1, 2\]/);
  assert.match(
    suite,
    /run: pnpm --filter @gym\/api exec vitest run --config \.\/vitest\.config\.e2e\.ts --shard=\$\{\{ matrix\.shard \}\}\/2/,
  );
  assert.match(suite, /if: matrix\.shard == 1\n\s+run: pnpm api:contract:check/);
  assert.match(
    suite,
    /Rehearse isolated PostgreSQL 17 and avatar restore \(disposable CI only\)\n\s+if: matrix\.shard == 1/,
  );
  assert.match(gate, /needs: \[changes, api-e2e-suite, api-coverage\]/);
  assert.match(gate, /test "\$SUITE_RESULT" = success/);
  assert.doesNotMatch(suite, /--passWithNoTests/);

  // The volume test runs inside normal E2E (not a separate, optional gate).
  const volumePath =
    '../apps/api/test/integration/auth/auth-cleanup-volume.integration.e2e-spec.ts';
  const volumeTest = readFileSync(new URL(volumePath, import.meta.url), 'utf8');
  assert.match(volumeTest, /EXPIRED_PER_TABLE = 1_200/);
  assert.match(volumeTest, /\[500, 500, 500\]/);
  assert.match(volumeTest, /\[200, 200, 200\]/);
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
    { paths: ['apps/landing/src/app/page.tsx'], run: false },
    { paths: ['README.md', 'docs/api/testing.md'], run: false },
    { paths: ['apps/api/README.md', 'apps/web/README.md', 'infra/docker/README.md'], run: false },
    { paths: ['infra/docker/production/README.md'], run: false },
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
  assert.match(yaml, /name: Web \/ Integration E2E/);
  assert.match(yaml, /name: Web \/ Real API and PostgreSQL\n/);
  const suite = yaml.split('  browser-api-suite:\n')[1]?.split('\n  browser-api:\n')[0];
  assert.ok(suite, 'Web integration matrix suite must exist');
  assert.ok(suite.includes('fail-fast: false'));
  assert.ok(suite.includes('shard: [1, 2, 3, 4]'));
  assert.ok(suite.includes('WEB_E2E_SHARD_INDEX: '));
  assert.ok(suite.includes("WEB_E2E_SHARD_COUNT: '4'"));
  assert.ok(suite.includes('real-api-browser-failures-'));
  assert.ok(suite.includes('POSTGRES_DB: gym_browser_test'));
  assert.ok(
    suite.includes('pnpm --filter @gym/web exec vitest run test/real-api-e2e-shards.test.mjs'),
  );
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
    /needs:\n\s+- changes\n\s+- quality-workspaces\n\s+- tooling-contracts\n\s+- prepush-windows\n\s+- web-browser-e2e\n\s+- admin-browser-e2e\n\s+- dependency-security\n\s+- mobile-ios-dev-windows/,
  );
  const admin = yaml.split('  admin-browser-e2e:\n')[1]?.split('\n  landing-browser-e2e:\n')[0];
  assert.ok(admin, 'Admin Chromium job must exist');
  assert.match(admin, /if: needs\.changes\.outputs\.admin == 'true'/);
  assert.match(admin, /pnpm --filter @gym\/admin test:e2e/);
  assert.match(admin, /mcr\.microsoft\.com\/playwright:v1\.65\.1/);
  assert.match(quality, /test "\$ADMIN_E2E_RESULT" = success/);
  assert.match(quality, /test "\$ADMIN_E2E_RESULT" = skipped/);
  assert.match(quality, /if: always\(\)/);
  const tooling = yaml.split('  tooling-contracts:\n')[1]?.split('\n  prepush-windows:\n')[0];
  assert.ok(tooling, 'Root Vitest contract job must exist');
  assert.match(tooling, /pnpm install --frozen-lockfile/);
  assert.match(tooling, /run: pnpm test:tooling/);
  assert.match(quality, /TOOLING_CONTRACTS_RESULT:/);
  assert.match(quality, /test "\$TOOLING_CONTRACTS_RESULT" = success/);
  assert.match(quality, /QUALITY_WORKSPACES_RESULT:/);
  assert.match(quality, /test "\$QUALITY_WORKSPACES_RESULT" = success/);
  assert.match(quality, /MOBILE_IOS_DEV_RESULT:/);
  assert.match(quality, /test "\$MOBILE_IOS_DEV_RESULT" = success/);
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
    'apps/landing/package.json',
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
  const quality = workflow.split('  quality-workspaces:\n')[1]?.split('\n  quality:\n')[0];
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
