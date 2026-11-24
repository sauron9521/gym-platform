import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Knip is report-only, with unsafe dynamic staging config loading disabled', () => {
  const pkg = JSON.parse(read('package.json'));
  const config = JSON.parse(read('knip.json'));
  assert.ok(pkg.devDependencies.knip);
  assert.equal(pkg.scripts.knip, 'knip');
  assert.match(pkg.scripts['knip:report'], /--no-exit-code/);
  assert.doesNotMatch(pkg.scripts['knip:report'], /--fix|--allow-remove-files|--max-show-issues/);
  assert.equal(config.workspaces['apps/admin'].playwright, false);
  assert.ok(config.workspaces['apps/admin'].entry.includes('e2e/**/*.spec.ts'));
});

test('Knip preserves both Web Playwright suites as static entrypoints', () => {
  const config = JSON.parse(read('knip.json'));
  const web = config.workspaces['apps/web'];
  const pkg = JSON.parse(read('apps/web/package.json'));
  assert.equal(web.playwright, false);
  assert.deepEqual(web.entry, [
    'playwright.config.ts',
    'playwright.integration.config.ts',
    'e2e/specs/**/*.spec.ts',
    'e2e/integration/**/*.spec.ts',
    'e2e/support/mock-api.mjs',
  ]);
  assert.equal(pkg.scripts['test:e2e'], 'playwright test');
  assert.equal(pkg.scripts['test:e2e:integration'], 'node scripts/run-real-api-e2e.mjs');
  const realConfig = read('apps/web/playwright.integration.config.ts');
  assert.match(realConfig, /TEST_DATABASE_URL/);
  assert.match(realConfig, /database !== process.env.DATABASE_URL/);
  assert.match(realConfig, /testDir: '\.\/e2e\/integration'/);
});

test('Knip recognizes explicitly invoked CLI and compile-time entrypoints', () => {
  const { workspaces } = JSON.parse(read('knip.json'));
  const api = JSON.parse(read('apps/api/package.json'));
  assert.equal(
    api.scripts['docs:openapi'],
    'nest build && node dist/infra/openapi/export-openapi.js',
  );
  assert.deepEqual(workspaces['apps/api'].entry, [
    'src/main.ts',
    'src/infra/openapi/export-openapi.ts',
    'test/support/seed-admin-browser.ts',
  ]);
  assert.match(read('.github/workflows/ci.yml'), /exec tsx test\/support\/seed-admin-browser\.ts/);
  for (const app of ['admin', 'web']) {
    assert.ok(workspaces['apps/' + app].entry.includes('e2e/support/mock-api.mjs'));
    assert.match(read('apps/' + app + '/playwright.config.ts'), /node e2e\/support\/mock-api\.mjs/);
  }
  assert.deepEqual(workspaces['packages/api-client'].entry, ['test/contract-types.test.ts']);
  const tsconfig = JSON.parse(read('packages/api-client/tsconfig.json'));
  assert.ok(tsconfig.include.includes('test/**/*.ts'));
  assert.equal(tsconfig.compilerOptions.noEmit, true);
  assert.doesNotMatch(read('packages/api-client/vitest.config.mts'), /contract-types/);
});

test('Knip preserves the Prisma generated client runtime dependency in API only', () => {
  const config = JSON.parse(read('knip.json'));
  const api = JSON.parse(read('apps/api/package.json'));
  assert.deepEqual(config.workspaces['apps/api'].ignoreDependencies, ['@prisma/client']);
  assert.ok(api.dependencies['@prisma/client']);
  assert.equal(api.imports['#prisma/*'].types, './src/infra/database/generated/prisma/*.ts');
  assert.match(read('apps/api/prisma/schemas/schema.prisma'), /provider\s*=\s*"prisma-client"/);
  assert.match(read('apps/api/src/infra/database/prisma.service.ts'), /from '#prisma\/client'/);
});

test('Knip recognizes the API bootstrap and retains the Vitest declaration companion', () => {
  const config = JSON.parse(read('knip.json'));
  const api = JSON.parse(read('apps/api/package.json'));
  assert.equal(api.scripts['start:prod'], 'node dist/main.js');
  assert.ok(config.workspaces['apps/api'].entry.includes('src/main.ts'));
  assert.deepEqual(config.ignoreFiles, ['tooling/vitest/node.d.mts']);
  assert.match(read('tooling/vitest/node.d.mts'), /export function nodeTestConfig/);
  assert.match(read('tooling/vitest/node.mjs'), /export function nodeTestConfig/);
  assert.match(read('apps/web/vitest.config.mts'), /tooling\/vitest\/node\.mjs/);
});

test('Vitest discovers real design-token spec.mts and Web mutation .test.ts suites', () => {
  const tokens = read('packages/design-tokens/vitest.config.mts');
  assert.match(tokens, /test\/\*\*\/\*\.test\.mjs/);
  assert.match(tokens, /test\/\*\*\/\*\.spec\.mts/);
  const web = read('apps/web/vitest.components.config.mts');
  assert.match(web, /test\/components\/\*\*\/\*\.test\.tsx/);
  assert.match(web, /test\/components\/\*\*\/\*\.test\.ts/);
  assert.match(read('packages/design-tokens/test/ovranto-theme.spec.mts'), /WCAG AA/);
  assert.match(
    read('packages/design-tokens/test/theme-parity.spec.mts'),
    /generates the checked-in/,
  );
  assert.match(
    read('apps/web/test/components/workout-set-mutation-feedback.test.ts'),
    /persisted matching set response/,
  );
});

test('manual hygiene workflow never replaces required CI gates or performs writes', () => {
  const audit = read('.github/workflows/tooling-audit.yml');
  assert.match(audit, /^  workflow_dispatch:$/m);
  assert.doesNotMatch(audit, /^  (?:push|pull_request|schedule):$/m);
  assert.match(audit, /permissions:\n  contents: read/);
  assert.match(audit, /persist-credentials: false/);
  assert.match(audit, /pnpm install --frozen-lockfile/);
  assert.match(audit, /pnpm --filter @gym\/api db:generate/);
  assert.match(audit, /pnpm knip:report --reporter json --output-file/);
  assert.match(audit, /json=\$RUNNER_TEMP\/knip\.json/);
  assert.match(audit, /\$\{\{ runner\.temp \}\}\/knip\.json/);
  assert.match(audit, /--dry=json/);
  assert.doesNotMatch(audit, /continue-on-error: true|pnpm knip --fix/);

  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /name: Quality \/ Node 24/);
  assert.match(ci, /pnpm test:tooling/);
});

test('Turborepo diagnostic retains its existing non-cached test and conservative selection', () => {
  const turbo = JSON.parse(read('turbo.json'));
  const selection = read('scripts/ci-select.mjs');
  const pkg = JSON.parse(read('package.json'));
  assert.equal(turbo.tasks.test.cache, false);
  assert.deepEqual(turbo.tasks.typecheck.dependsOn, ['^typecheck']);
  assert.match(pkg.scripts['turbo:plan'], /--dry=json/);
  assert.match(selection, /return allScopes\(\)/);
});

test('root owns shared Next ESLint preset while apps retain local lint CLI', () => {
  const root = JSON.parse(read('package.json'));
  assert.ok(root.devDependencies.eslint);
  assert.ok(root.devDependencies['eslint-config-next']);
  assert.ok(root.devDependencies.typescript);
  for (const app of ['admin', 'landing', 'trainer', 'web']) {
    const manifest = JSON.parse(read('apps/' + app + '/package.json'));
    assert.equal(manifest.devDependencies.eslint, root.devDependencies.eslint);
    assert.equal(manifest.devDependencies.typescript, root.devDependencies.typescript);
    assert.equal(manifest.devDependencies['eslint-config-next'], undefined);
    assert.equal(manifest.scripts.lint, 'eslint .');
    assert.match(read('apps/' + app + '/eslint.config.mjs'), /tooling\/config\/eslint-next\.mjs/);
  }
});

test('DOM Vitest aliases and setup resolve the same app-owned renderer', () => {
  for (const app of ['admin', 'landing', 'trainer', 'web']) {
    const manifest = JSON.parse(read('apps/' + app + '/package.json'));
    const suffix = app === 'trainer' ? '' : '.components';
    const config = read('apps/' + app + '/vitest' + suffix + '.config.mts');
    assert.ok(manifest.devDependencies['@testing-library/react']);
    assert.match(config, /createRequire\(import\.meta\.url\)\.resolve\('@testing-library\/react'\)/);
    assert.match(config, /reactDomTestAliases\(rendererPath\)/);
    assert.match(config, /env: \{ GYM_VITEST_DOM_RENDERER: rendererPath \}/);
    assert.match(config, /tooling\/vitest\/react-dom\.setup\.mjs/);
  }
  const aliases = read('tooling/vitest/react-dom.mjs');
  const setup = read('tooling/vitest/react-dom.setup.mjs');
  assert.match(aliases, /createRequire\(rendererPath\)/);
  assert.match(setup, /process\.env\.GYM_VITEST_DOM_RENDERER/);
  assert.match(setup, /createRequire\(rendererPath\)/);
  assert.match(setup, /isAbsolute\(rendererPath\)/);
  assert.doesNotMatch(setup, /resolve\('@testing-library\/react'\)/);
});
