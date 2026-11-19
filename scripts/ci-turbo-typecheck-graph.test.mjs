import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const turbo = JSON.parse(read('turbo.json'));
const workflow = read('.github/workflows/ci.yml');
const quality = workflow.split('  quality-workspaces:\n')[1];

test('typecheck depends on source dependency typechecks, not builds', () => {
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

test('full CI runs lint and typecheck together before tests and build', () => {
  assert.ok(quality);
  const full = quality.split('      - name: Full workspace regression')[1];
  assert.ok(full);
  const script = full.split('      - name: Lint, typecheck, test and build')[0];
  const lint = script.indexOf('pnpm exec turbo run lint typecheck');
  const tests = script.indexOf('pnpm exec turbo run test');
  const build = script.indexOf('pnpm build');
  assert.ok(lint !== -1 && lint < tests && tests < build);
  assert.ok(!script.includes('\n          pnpm lint\n'));
  assert.ok(!script.includes('\n          pnpm typecheck\n'));
});

test('affected CI preserves filters, tests, builds and required gates', () => {
  assert.ok(quality);
  const affected = quality.split('      - name: Lint, typecheck, test and build')[1];
  assert.ok(affected);
  assert.ok(affected.includes('pnpm exec turbo run lint typecheck "${filters[@]}"'));
  assert.ok(affected.includes('pnpm exec turbo run test'));
  assert.ok(affected.includes('pnpm exec turbo run build "${filters[@]}"'));
  assert.ok(affected.includes('test_filters=()'));
  assert.ok(affected.includes('CI_API:'));
  assert.ok(affected.includes('CI_WEB:'));
  assert.ok(affected.includes('CI_MOBILE:'));
  assert.match(workflow, /name: Quality \/ Node 24/);
  assert.match(workflow, /name: API e2e \/ PostgreSQL 17/);
});

test('Turbo dry-run typechecks shared source without dependency builds', () => {
  const cmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(
    cmd,
    ['exec', 'turbo', 'run', 'typecheck', '--filter=@gym/web', '--dry=json'],
    {
      cwd: new URL('../', import.meta.url),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const tasks = JSON.parse(result.stdout).tasks.map((task) => task.taskId);
  assert.ok(tasks.includes('@gym/web#typecheck'));
  assert.ok(tasks.includes('@gym/api-client#typecheck'));
  assert.ok(tasks.includes('@gym/ui-web#typecheck'));
  assert.ok(!tasks.some((task) => task.endsWith('#build')));
});
