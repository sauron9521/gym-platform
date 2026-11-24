import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import { changedPathsBetween, compareAffectedPlans } from './ci-turbo-affected-shadow.mjs';

const apps = ['@gym/admin', '@gym/api', '@gym/api-client', '@gym/landing', '@gym/mobile', '@gym/trainer', '@gym/web'];
const changedCases = [
  ['API', ['apps/api/src/modules/users/users.service.ts'], ['@gym/api']],
  ['Web', ['apps/web/src/app/page.tsx'], ['@gym/web']],
  ['Landing', ['apps/landing/src/app/page.tsx'], ['@gym/landing']],
  ['Admin', ['apps/admin/src/app/page.tsx'], ['@gym/admin']],
  ['Trainer', ['apps/trainer/src/app/page.tsx'], ['@gym/trainer']],
  ['Mobile', ['apps/mobile/app/index.tsx'], ['@gym/mobile']],
  [
    'API client',
    ['packages/api-client/src/generated/schema.d.ts'],
    ['@gym/admin', '@gym/api-client', '@gym/mobile', '@gym/trainer', '@gym/web'],
  ],
  [
    'shared UI',
    ['packages/ui-web/src/button.tsx'],
    ['@gym/admin', '@gym/landing', '@gym/trainer', '@gym/web'],
  ],
  [
    'i18n',
    ['packages/i18n/src/messages/uk.json'],
    ['@gym/admin', '@gym/api', '@gym/landing', '@gym/mobile', '@gym/trainer', '@gym/web'],
  ],
  [
    'design tokens',
    ['packages/design-tokens/src/dark.css'],
    ['@gym/admin', '@gym/landing', '@gym/mobile', '@gym/trainer', '@gym/web'],
  ],
  [
    'OpenAPI',
    ['apps/api/openapi/openapi.json'],
    ['@gym/admin', '@gym/api', '@gym/api-client', '@gym/mobile', '@gym/trainer', '@gym/web'],
  ],
  ['docs-only', ['docs/ci-affected-workspaces.md'], []],
  ['root lockfile', ['pnpm-lock.yaml'], apps],
  ['unknown package', ['packages/new-package/src/index.ts'], apps],
  [
    'mixed shared and mobile',
    ['packages/ui-web/src/button.tsx', 'apps/mobile/app/index.tsx'],
    ['@gym/admin', '@gym/landing', '@gym/mobile', '@gym/trainer', '@gym/web'],
  ],
];

function plan(packages) {
  return {
    tasks: packages.flatMap((name) => [
      { taskId: name + '#lint', task: 'lint', package: name },
      { taskId: name + '#build', task: 'build', package: name },
      { taskId: name + '#typecheck', task: 'typecheck', package: name },
    ]),
  };
}

test.each(changedCases)('%s: shadow comparator reflects conservative CI scopes', (_name, paths, expected) => {
  const result = compareAffectedPlans(paths, plan(expected));
  assert.deepEqual(result.requiredPackages, expected);
  assert.deepEqual(result.missingFromTurbo, []);
  assert.deepEqual(result.extraAppPackages, []);
  assert.equal(result.status, 'no-missing-workspaces');
});

test('detects potential false negatives without suppressing or re-routing CI', () => {
  const result = compareAffectedPlans(
    ['packages/api-client/src/index.ts'],
    plan(['@gym/web', '@gym/ui-web', '@gym/api-client']),
  );
  assert.deepEqual(result.missingFromTurbo, ['@gym/admin', '@gym/mobile', '@gym/trainer']);
  assert.equal(result.status, 'review-required');
  assert.equal(result.ciSelection.api, false);
  assert.equal(result.ciSelection.web, true);
  assert.ok(result.limitation.includes('Informational only'));
});

test('keeps additional Turbo-selected applications visible rather than treating them as errors', () => {
  const result = compareAffectedPlans(['apps/web/src/app/page.tsx'], plan(['@gym/web', '@gym/admin']));
  assert.deepEqual(result.missingFromTurbo, []);
  assert.deepEqual(result.extraAppPackages, ['@gym/admin']);
  assert.equal(result.status, 'no-missing-workspaces');
});

test('rejects invalid dry-run shapes instead of accidentally accepting an empty plan', () => {
  for (const bad of [null, {}, { tasks: {} }, { tasks: [null] }, { tasks: [{}] }]) {
    assert.throws(() => compareAffectedPlans(['apps/web/src/index.ts'], bad), /Invalid/);
  }
  assert.throws(() => compareAffectedPlans([42], plan([])), /Invalid/);
  assert.throws(() => compareAffectedPlans([''], plan([])), /Invalid/);
});

test('uses explicit SHA ancestry and NUL-separated filenames to compare the same Git range', () => {
  const base = 'a'.repeat(40);
  const head = 'b'.repeat(40);
  const calls = [];
  const git = (command, args, options) => {
    calls.push({ command, args, options });
    if (args[0] === 'diff') return 'apps/web/src/a weird file.tsx\0docs/README.md\0';
    return '';
  };
  assert.deepEqual(changedPathsBetween(base, head, git), [
    'apps/web/src/a weird file.tsx',
    'docs/README.md',
  ]);
  assert.deepEqual(calls.map(({ args }) => args), [
    ['merge-base', '--is-ancestor', base, head],
    ['diff', '--name-only', '-z', '--no-renames', base + '...' + head],
  ]);
  assert.equal(calls[1].options.encoding, 'utf8');
});

test('invalid revisions or Git history cannot produce a misleading parity report', () => {
  assert.throws(() => changedPathsBetween('HEAD^', 'HEAD'), /SHA/);
  const fail = () => {
    throw new Error('insufficient Git history');
  };
  assert.throws(() => changedPathsBetween('a'.repeat(40), 'b'.repeat(40), fail), /history/);
});

test('on-demand audit is read-only and cannot override the required classifier', () => {
  const workflow = readFileSync(new URL('../.github/workflows/tooling-audit.yml', import.meta.url), 'utf8');
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /^  workflow_dispatch:$/m);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /TURBO_SCM_BASE/);
  assert.match(workflow, /TURBO_SCM_HEAD/);
  assert.match(workflow, /--affected --dry=json/);
  assert.match(workflow, /node scripts\/ci-turbo-affected-shadow\.mjs/);
  assert.match(workflow, /turbo-affected-comparison\.json/);
  assert.doesNotMatch(ci, /ci-turbo-affected-shadow|TURBO_SCM_BASE/);
  assert.match(ci, /node scripts\/ci-select\.mjs --github-output/);
});
