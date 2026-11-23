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
  assert.doesNotMatch(pkg.scripts['knip:report'], /--fix|--allow-remove-files/);
  assert.equal(config.workspaces['apps/admin'].playwright, false);
  assert.ok(config.workspaces['apps/admin'].entry.includes('e2e/**/*.spec.ts'));
});

test('manual hygiene workflow never replaces required CI gates or performs writes', () => {
  const audit = read('.github/workflows/tooling-audit.yml');
  assert.match(audit, /^  workflow_dispatch:$/m);
  assert.doesNotMatch(audit, /^  (?:push|pull_request|schedule):$/m);
  assert.match(audit, /permissions:\n  contents: read/);
  assert.match(audit, /persist-credentials: false/);
  assert.match(audit, /pnpm install --frozen-lockfile/);
  assert.match(audit, /pnpm --filter @gym\/api db:generate/);
  assert.match(audit, /pnpm knip:report/);
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
