import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createPrePushPlan, findPushedPaths, parsePushRefs } from './pre-push-checks.mjs';

const oldSha = 'a'.repeat(40);
const headSha = 'b'.repeat(40);
const mainSha = 'c'.repeat(40);
const mergeBase = 'd'.repeat(40);
const zeroSha = '0'.repeat(40);
const line = (oldValue, newValue = headSha) =>
  'refs/heads/feature ' + newValue + ' refs/heads/feature ' + oldValue + '\n';

test('parses one or more Git pre-push ref updates', () => {
  const result = parsePushRefs(line(oldSha) + line(oldSha, 'e'.repeat(40)));
  assert.equal(result.length, 2);
  assert.equal(result[0].remoteSha, oldSha);
  assert.equal(result[1].localSha, 'e'.repeat(40));
});

test('rejects malformed, missing and whitespace-only ref updates', () => {
  for (const value of ['', ' ', 'refs/heads/a abc refs/heads/a xyz\n', 'bad line\n']) {
    assert.equal(parsePushRefs(value), null);
  }
});

test('existing branch checks only the exact pushed diff and supports filenames with spaces', () => {
  const seen = [];
  const result = findPushedPaths(line(oldSha), {
    git: (args) => {
      seen.push(args);
      return 'apps/web/app/page.tsx\0docs/a file.md\0';
    },
  });
  assert.deepEqual(result, {
    full: false,
    files: ['apps/web/app/page.tsx', 'docs/a file.md'],
  });
  assert.deepEqual(seen[0].slice(0, 5), [
    'diff',
    '--name-only',
    '-z',
    '--no-renames',
    '--diff-filter=ACMRT',
  ]);
  assert.deepEqual(seen[0].slice(5, 7), [oldSha, headSha]);
});

test('new branch compares against remote main merge-base', () => {
  const calls = [];
  const result = findPushedPaths(line(zeroSha), {
    git: (args) => {
      calls.push(args);
      if (args[0] === 'rev-parse') return mainSha + '\n';
      if (args[0] === 'merge-base') return mergeBase + '\n';
      return 'apps/api/src/main.ts\0';
    },
  });
  assert.deepEqual(calls[0], ['rev-parse', '--verify', 'refs/remotes/origin/main']);
  assert.deepEqual(calls[1], ['merge-base', mainSha, headSha]);
  assert.deepEqual(calls[2].slice(5, 7), [mergeBase, headSha]);
  assert.deepEqual(result.files, ['apps/api/src/main.ts']);
});

test('multiple refs union changed files and deduplicate work', () => {
  const result = findPushedPaths(line(oldSha) + line(oldSha, 'e'.repeat(40)), {
    git: (args) =>
      args.includes(headSha)
        ? 'apps/web/src/index.ts\0docs/README.md\0'
        : 'apps/mobile/app/index.tsx\0apps/web/src/index.ts\0',
  });
  assert.deepEqual(result.files, [
    'apps/mobile/app/index.tsx',
    'apps/web/src/index.ts',
    'docs/README.md',
  ]);
});

test('an unreadable ref or absent remote main fails closed to full checks', () => {
  for (const value of [line(oldSha), line(zeroSha)]) {
    const result = findPushedPaths(value, {
      git: () => {
        throw new Error('Unknown object');
      },
    });
    assert.equal(result.full, true);
  }
  assert.equal(findPushedPaths('').full, true);
  assert.equal(findPushedPaths(line(oldSha), { remote: '--unsafe' }).full, true);
});

test('ref deletion or unchanged tip does not require source verification', () => {
  assert.deepEqual(findPushedPaths(line(oldSha, zeroSha)), { full: false, files: [] });
  assert.deepEqual(findPushedPaths(line(oldSha, oldSha)), { full: false, files: [] });
});

test('web-only push skips API and Mobile checks', () => {
  const plan = createPrePushPlan({ full: false, files: ['apps/web/src/app/page.tsx'] });
  assert.equal(plan.scopes.web, true);
  assert.equal(plan.scopes.api, false);
  assert.ok(plan.commands.some((cmd) => cmd.includes('@gym/web') && cmd.includes('lint')));
  assert.ok(!plan.commands.some((cmd) => cmd.includes('@gym/api')));
  assert.ok(!plan.commands.some((cmd) => cmd.includes('@gym/mobile')));
});

test('mobile-only push checks only Mobile and selected formatting', () => {
  const plan = createPrePushPlan({ full: false, files: ['apps/mobile/app/index.tsx'] });
  assert.deepEqual(
    plan.commands.filter((cmd) => cmd.includes('--filter')).map((cmd) => cmd[2]),
    ['@gym/mobile', '@gym/mobile'],
  );
});

test('API-only push generates Prisma client before lint and typecheck', () => {
  const plan = createPrePushPlan({
    full: false,
    files: ['apps/api/prisma/schemas/users.prisma'],
  });
  const commands = plan.commands.map((cmd) => cmd.join(' '));
  assert.ok(commands.indexOf('pnpm --filter @gym/api db:generate') !== -1);
  assert.ok(commands.indexOf('pnpm --filter @gym/api db:generate') <
    commands.indexOf('pnpm --filter @gym/api typecheck'));
  assert.ok(!commands.some((cmd) => cmd.includes('@gym/web')));
});

test('API client changes check Web, Mobile and shared types', () => {
  const plan = createPrePushPlan({
    full: false,
    files: ['packages/api-client/src/generated/schema.d.ts'],
  });
  assert.equal(plan.scopes.api, false);
  for (const name of ['@gym/api-client', '@gym/web', '@gym/mobile']) {
    assert.ok(plan.commands.some((cmd) => cmd.includes(name)));
  }
});

test('docs-only push runs scoped Prettier without workspace checks', () => {
  const plan = createPrePushPlan({
    full: false,
    files: ['docs/ci-affected-workspaces.md'],
  });
  assert.equal(plan.commands.length, 1);
  assert.deepEqual(plan.commands[0].slice(0, 4), [
    'pnpm',
    'exec',
    'prettier',
    '--check',
  ]);
});

test('root, unknown, and failed diff fallback to whole-repo validation', () => {
  for (const input of [
    { full: true, files: [] },
    { full: false, files: ['pnpm-lock.yaml'] },
    { full: false, files: ['.github/workflows/ci.yml'] },
  ]) {
    const plan = createPrePushPlan(input);
    assert.equal(plan.scopes.full, true);
    assert.ok(plan.commands.some((cmd) => cmd.includes('format:check')));
    assert.ok(plan.commands.some((cmd) => cmd.includes('typecheck')));
  }
});

test('pre-push never rewrites committed source files', () => {
  const scenarios = [
    ['apps/web/src/app/page.tsx'],
    ['apps/api/src/main.ts'],
    ['apps/mobile/app/index.tsx'],
    ['docs/readme.md'],
  ];
  for (const files of scenarios) {
    const plan = createPrePushPlan({ full: false, files });
    assert.ok(!plan.commands.some((cmd) => cmd.includes('--write')));
    assert.ok(!plan.commands.some((cmd) => cmd.includes('format')));
  }
});
