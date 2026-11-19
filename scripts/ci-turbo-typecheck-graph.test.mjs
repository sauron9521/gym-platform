import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const turbo = JSON.parse(read('turbo.json'));
const workflow = read('.github/workflows/ci.yml');
const quality = workflow
  .split('  quality-workspaces:\n')[1]
  ?.split('\n  quality:\n')[0];

test('typechecks follow dependency typechecks, never dependency builds', () => {
  assert.deepEqual(turbo.tasks.typecheck.dependsOn, ['^typecheck']);
  assert.deepEqual(turbo.tasks.build.dependsOn, ['^build']);
  assert.equal(turbo.tasks.test.cache, false);
  for (const name of ['api-client', 'ui-web', 'i18n']) {
    const manifest = JSON.parse(read('packages/' + name + '/package.json'));
    assert.equal(manifest.exports['.'].types, './src/index.ts');
  }
  const tokens = JSON.parse(read('packages/design-tokens/package.json'));
  assert.equal(tokens.scripts.build, 'pnpm test');
});

test('full CI combines lint and typecheck but retains tests and builds', () => {
  assert.ok(quality, 'Quality workspaces job must exist');
  const full = quality
    .split('      - name: Full workspace regression')[1]
    ?.split('      - name: Lint, typecheck, test and build')[0];
  assert.ok(full, 'Full regression step missing');
  const lint = full.indexOf('pnpm exec turbo run lint typecheck');
  const tests = full.indexOf('pnpm exec turbo run test');
  const build = full.indexOf('pnpm build');
  assert.ok(lint !== -1 && lint < tests && tests < build);
  assert.ok(!full.includes('\n          pnpm lint\n'));
  assert.ok(!full.includes('\n          pnpm typecheck\n'));
});

test('affected CI keeps the same workspace filters and quality gates', () => {
  assert.ok(quality);
  const affected = quality.split('      - name: Lint, typecheck, test and build')[1];
  assert.ok(affected, 'Affected-workspace step missing');
  const command = 'pnpm exec turbo run lint typecheck "${filters[@]}"';
  assert.ok(affected.includes(command));
  assert.ok(affected.includes('pnpm exec turbo run test'));
  assert.ok(affected.includes('pnpm exec turbo run build "${filters[@]}"'));
  assert.ok(affected.includes('test_filters=()'));
  assert.ok(affected.includes('CI_API:'));
  assert.ok(affected.includes('CI_WEB:'));
  assert.ok(affected.includes('CI_MOBILE:'));
  assert.match(workflow, /name: Quality \/ Node 24/);
  assert.match(workflow, /name: API e2e \/ PostgreSQL 17/);
});
