import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'vitest';

import { classifyChangedPaths } from './ci-select.mjs';

const root = new URL('../', import.meta.url);
const workflow = readFileSync(new URL('.github/workflows/ci.yml', root), 'utf8');

function testableWorkspaces() {
  return ['apps', 'packages']
    .flatMap((group) =>
      readdirSync(new URL(group + '/', root), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((entry) => {
          const path = new URL(group + '/' + entry.name + '/package.json', root);
          if (!existsSync(path)) return [];
          const manifest = JSON.parse(readFileSync(path, 'utf8'));
          return manifest.scripts?.test ? [manifest] : [];
        }),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function fullRegression() {
  const quality = workflow.split('  quality-workspaces:\n')[1]?.split('\n  quality:\n')[0];
  assert.ok(quality, 'Workspace quality job is missing');
  const full = quality
    .split('      - name: Full workspace regression for main and cross-cutting changes\n')[1]
    ?.split('      - name: Lint, typecheck, test and build affected workspaces\n')[0];
  assert.ok(full, 'Full main regression step is missing');
  assert.match(full, /if: needs\.changes\.outputs\.full == 'true'/);
  return { full, quality };
}

test('every testable workspace has a full-main-CI execution path', () => {
  const { full, quality } = fullRegression();
  const command = full
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('pnpm exec turbo run test --filter='));
  assert.ok(command, 'Explicit full regression test command is missing');

  const filters = [...command.matchAll(/--filter=(@gym\/[a-z0-9-]+)/g)].map((match) => match[1]);
  assert.equal(new Set(filters).size, filters.length, 'Duplicate full-CI test filters');

  const manifests = testableWorkspaces();
  const byName = new Map(manifests.map((manifest) => [manifest.name, manifest]));
  assert.ok(manifests.length > 0, 'No workspace test scripts discovered');
  for (const filter of filters) {
    assert.ok(byName.has(filter), 'Full-CI test filter has no test script: ' + filter);
  }

  const apiCoverage =
    workflow.includes('  api-coverage:\n') &&
    workflow.includes('run: pnpm --filter @gym/api test:cov') &&
    workflow.includes('needs: [changes, api-e2e-suite, api-coverage]');
  const catalogTest = quality.includes('run: pnpm --filter @gym/i18n test');
  const designTokensBuild =
    byName.get('@gym/design-tokens')?.scripts.build === 'pnpm test' &&
    full.includes('          pnpm build\n');

  const uncovered = manifests
    .filter(
      ({ name }) =>
        !filters.includes(name) &&
        !(name === '@gym/api' && apiCoverage) &&
        !(name === '@gym/i18n' && catalogTest) &&
        !(name === '@gym/design-tokens' && designTokensBuild),
    )
    .map(({ name }) => name);
  assert.deepEqual(
    uncovered,
    [],
    'Workspace test scripts missing from the full main CI: ' + uncovered.join(', '),
  );
});

test('Domain edits force the full CI that explicitly runs Domain tests', () => {
  const { full } = fullRegression();
  assert.match(full, /--filter=@gym\/domain(?:\s|$)/);
  for (const path of [
    'packages/domain/package.json',
    'packages/domain/src/index.ts',
    'packages/domain/test/workout-domain.test.mjs',
  ]) {
    assert.equal(classifyChangedPaths([path]).full, true, path + ' must run the full regression');
  }
});

test('Datetime edits force full CI and explicit datetime test coverage', () => {
  const { full } = fullRegression();
  assert.match(full, /--filter=@gym\/datetime(?:\s|$)/);
  for (const path of [
    'packages/datetime/package.json',
    'packages/datetime/src/index.js',
    'packages/datetime/test/datetime.test.mjs',
  ]) {
    assert.equal(classifyChangedPaths([path]).full, true, path);
  }
});
