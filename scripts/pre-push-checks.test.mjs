import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

import {
  createPrePushPlan,
  findPushedPaths,
  parsePushRefs,
  resolvePrePushCommand,
  runPrePushChecks,
} from './pre-push-checks.mjs';

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
      return 'M\0apps/web/app/page.tsx\0A\0docs/a file.md\0';
    },
  });
  assert.deepEqual(result, {
    full: false,
    files: ['apps/web/app/page.tsx', 'docs/a file.md'],
    deletedFiles: [],
  });
  assert.deepEqual(seen[0].slice(0, 4), ['diff', '--name-status', '-z', '--no-renames']);
  assert.deepEqual(seen[0].slice(4, 6), [oldSha, headSha]);
});

test('new branch compares against remote main merge-base', () => {
  const calls = [];
  const result = findPushedPaths(line(zeroSha), {
    git: (args) => {
      calls.push(args);
      if (args[0] === 'rev-parse') return mainSha + '\n';
      if (args[0] === 'merge-base') return mergeBase + '\n';
      return 'M\0apps/api/src/main.ts\0';
    },
  });
  assert.deepEqual(calls[0], ['rev-parse', '--verify', 'refs/remotes/origin/main']);
  assert.deepEqual(calls[1], ['merge-base', mainSha, headSha]);
  assert.deepEqual(calls[2].slice(4, 6), [mergeBase, headSha]);
  assert.deepEqual(result.files, ['apps/api/src/main.ts']);
});

test('multiple refs union changed files and deduplicate work', () => {
  const result = findPushedPaths(line(oldSha) + line(oldSha, 'e'.repeat(40)), {
    git: (args) =>
      args.includes(headSha)
        ? 'M\0apps/web/src/index.ts\0D\0docs/README.md\0'
        : 'A\0apps/mobile/app/index.tsx\0M\0apps/web/src/index.ts\0',
  });
  assert.deepEqual(result.files, [
    'apps/mobile/app/index.tsx',
    'apps/web/src/index.ts',
    'docs/README.md',
  ]);
  assert.deepEqual(result.deletedFiles, ['docs/README.md']);
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
  assert.deepEqual(findPushedPaths(line(oldSha, zeroSha)), {
    full: false,
    files: [],
    deletedFiles: [],
  });
  assert.deepEqual(findPushedPaths(line(oldSha, oldSha)), {
    full: false,
    files: [],
    deletedFiles: [],
  });
});

test('deleted source files select workspaces without passing absent paths to Prettier', () => {
  const result = findPushedPaths(line(oldSha), {
    git: () => 'D\0apps/web/src/deleted.ts\0M\0docs/changed.md\0',
  });
  assert.deepEqual(result.deletedFiles, ['apps/web/src/deleted.ts']);
  const plan = createPrePushPlan(result);
  assert.equal(plan.scopes.web, true);
  assert.equal(plan.scopes.api, false);
  assert.deepEqual(plan.commands[0].slice(6), ['docs/changed.md']);
  assert.ok(plan.commands.some((command) => command.includes('@gym/web')));
  assert.ok(!plan.commands.flat().includes('apps/web/src/deleted.ts'));
});

test('deletion-only shared and root changes retain conservative checks', () => {
  const shared = createPrePushPlan(
    findPushedPaths(line(oldSha), { git: () => 'D\0packages/ui-web/src/button.tsx\0' }),
  );
  for (const scope of ['web', 'admin', 'trainer', 'landing']) {
    assert.equal(shared.scopes[scope], true);
  }
  assert.ok(!shared.commands.some((command) => command.includes('prettier')));

  const root = createPrePushPlan(
    findPushedPaths(line(oldSha), { git: () => 'D\0pnpm-lock.yaml\0' }),
  );
  assert.equal(root.scopes.full, true);
  assert.ok(root.commands.some((command) => command.includes('format:check')));

  const docs = createPrePushPlan(
    findPushedPaths(line(oldSha), { git: () => 'D\0docs/deleted.md\0' }),
  );
  assert.deepEqual(docs.commands, []);
});

test('malformed diff output or conflicting multi-ref path states fail closed', () => {
  for (const diff of ['D\0', 'M\0apps/web/a.ts', 'U\0apps/web/a.ts\0']) {
    assert.equal(findPushedPaths(line(oldSha), { git: () => diff }).full, true);
  }
  const conflict = findPushedPaths(line(oldSha) + line(oldSha, 'e'.repeat(40)), {
    git: (args) => (args.includes(headSha) ? 'D\0apps/web/a.ts\0' : 'M\0apps/web/a.ts\0'),
  });
  assert.equal(conflict.full, true);
});

test('real Git diff detects deletion and cross-workspace move as separate paths', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gym-pre-push-'));
  const git = (args) =>
    execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  try {
    git(['init', '-q']);
    git(['config', 'user.name', 'Pre-push test']);
    git(['config', 'user.email', 'pre-push@example.test']);
    git(['config', 'commit.gpgsign', 'false']);
    git(['config', 'core.hooksPath', join(directory, 'no-hooks')]);
    mkdirSync(join(directory, 'apps/web/src'), { recursive: true });
    mkdirSync(join(directory, 'apps/mobile/src'), { recursive: true });
    writeFileSync(join(directory, 'apps/web/src/old file.ts'), 'export const value = 1;\n');
    git(['add', '.']);
    git(['commit', '-qm', 'base']);
    const base = git(['rev-parse', 'HEAD']).trim();
    git(['mv', 'apps/web/src/old file.ts', 'apps/mobile/src/new file.ts']);
    git(['commit', '-qm', 'move']);
    const head = git(['rev-parse', 'HEAD']).trim();
    const result = findPushedPaths(line(base, head), { git });
    assert.deepEqual(result, {
      full: false,
      files: ['apps/mobile/src/new file.ts', 'apps/web/src/old file.ts'],
      deletedFiles: ['apps/web/src/old file.ts'],
    });
    const plan = createPrePushPlan(result);
    assert.equal(plan.scopes.web, true);
    assert.equal(plan.scopes.mobile, true);
    assert.deepEqual(plan.commands[0].slice(6), ['apps/mobile/src/new file.ts']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('web-only push skips API and Mobile checks', () => {
  const plan = createPrePushPlan({ full: false, files: ['apps/web/src/app/page.tsx'] });
  assert.equal(plan.scopes.web, true);
  assert.equal(plan.scopes.api, false);
  assert.ok(plan.commands.some((cmd) => cmd.includes('@gym/web') && cmd.includes('lint')));
  assert.ok(!plan.commands.some((cmd) => cmd.includes('@gym/api')));
  assert.ok(!plan.commands.some((cmd) => cmd.includes('@gym/mobile')));
});

test('landing-only push runs lint and typecheck', () => {
  const plan = createPrePushPlan({ full: false, files: ['apps/landing/src/app/page.tsx'] });
  assert.equal(plan.scopes.landing, true);
  assert.ok(plan.commands.some((cmd) => cmd.includes('@gym/landing') && cmd.includes('lint')));
  assert.ok(plan.commands.some((cmd) => cmd.includes('@gym/landing') && cmd.includes('typecheck')));
});

test.each([
  ['admin', '@gym/admin'],
  ['trainer', '@gym/trainer'],
])('%s-only push runs scoped lint and typecheck on Linux and Windows', (scope, workspace) => {
  const plan = createPrePushPlan({
    full: false,
    files: [`apps/${scope}/src/app/page.tsx`],
  });

  assert.equal(plan.scopes[scope], true);
  assert.deepEqual(
    plan.commands.filter((command) => command[1] === '--filter'),
    [
      ['pnpm', '--filter', workspace, 'lint'],
      ['pnpm', '--filter', workspace, 'typecheck'],
    ],
  );

  for (const command of plan.commands.filter((entry) => entry[1] === '--filter')) {
    for (const platform of ['linux', 'win32']) {
      const invocation = resolvePrePushCommand(command, { platform });
      assert.equal(invocation.executable, 'pnpm');
      assert.equal(invocation.shell, platform === 'win32');
      assert.deepEqual(invocation.args, command.slice(1));
    }
  }
});

test('shared UI changes check every web consumer without running API checks', () => {
  const plan = createPrePushPlan({
    full: false,
    files: ['packages/ui-web/src/index.ts'],
  });
  assert.equal(plan.scopes.api, false);
  for (const workspace of ['@gym/web', '@gym/admin', '@gym/trainer', '@gym/landing']) {
    for (const task of ['lint', 'typecheck']) {
      assert.ok(
        plan.commands.some((cmd) => cmd[2] === workspace && cmd[3] === task),
        `Expected ${task} for ${workspace}`,
      );
    }
  }
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
  assert.ok(
    commands.indexOf('pnpm --filter @gym/api db:generate') <
      commands.indexOf('pnpm --filter @gym/api typecheck'),
  );
  assert.ok(!commands.some((cmd) => cmd.includes('@gym/web')));
});

test('API client changes check all consumers and shared types', () => {
  const plan = createPrePushPlan({
    full: false,
    files: ['packages/api-client/src/generated/schema.d.ts'],
  });
  assert.equal(plan.scopes.api, false);
  for (const name of ['@gym/api-client', '@gym/web', '@gym/admin', '@gym/trainer', '@gym/mobile']) {
    assert.ok(plan.commands.some((cmd) => cmd.includes(name)));
  }
});

test('docs-only push runs scoped Prettier without workspace checks', () => {
  const plan = createPrePushPlan({
    full: false,
    files: ['docs/ci-affected-workspaces.md'],
  });
  assert.equal(plan.commands.length, 1);
  assert.deepEqual(plan.commands[0].slice(0, 4), ['pnpm', 'exec', 'prettier', '--check']);
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
    ['apps/admin/src/app/page.tsx'],
    ['apps/trainer/src/app/page.tsx'],
    ['apps/api/src/main.ts'],
    ['apps/mobile/app/index.tsx'],
    ['apps/landing/src/app/page.tsx'],
    ['docs/readme.md'],
  ];
  for (const files of scenarios) {
    const plan = createPrePushPlan({ full: false, files });
    assert.ok(!plan.commands.some((cmd) => cmd.includes('--write')));
    assert.ok(!plan.commands.some((cmd) => cmd.includes('format')));
  }
});

test('ref-only deletion and empty net diff run no local commands', () => {
  const deletion = findPushedPaths(line(oldSha, zeroSha));
  const plan = createPrePushPlan(deletion);
  assert.equal(plan.scopes.full, false);
  assert.deepEqual(plan.commands, []);
});

test('Windows passes adversarial Git filenames directly to Node, never to cmd.exe', () => {
  const unsafeNames = [
    'docs/a & echo INJECTION.md',
    'docs/a ^ (echo exploit).md',
    'apps/web/src/%PATH% & echo injected.tsx',
    'apps/web/src/!USERNAME! file.tsx',
    'docs/semicolon;dollar$(touch file).md',
    'docs/файл зі пробілами.md',
  ];
  for (const filename of unsafeNames) {
    const plan = createPrePushPlan({ full: false, files: [filename] });
    const invocation = resolvePrePushCommand(plan.commands[0], {
      platform: 'win32',
      nodeExecutable: 'C:/Program Files/nodejs/node.exe',
    });

    assert.equal(invocation.shell, false);
    assert.equal(invocation.executable, 'C:/Program Files/nodejs/node.exe');
    assert.match(invocation.args[0], /prettier[\\/]bin[\\/]prettier\.cjs$/);
    assert.deepEqual(invocation.args.slice(1, 4), ['--check', '--ignore-unknown', '--']);
    assert.equal(invocation.args.at(-1), filename);
  }
});

test('only fixed pnpm commands use Windows shell shim', () => {
  const plan = createPrePushPlan({
    full: false,
    files: ['apps/web/src/page.tsx'],
  });
  const pnpmCommands = plan.commands.filter((command) => command[2] === '@gym/web');
  assert.equal(pnpmCommands.length, 2);
  for (const command of pnpmCommands) {
    const invocation = resolvePrePushCommand(command, { platform: 'win32' });
    assert.equal(invocation.executable, 'pnpm');
    assert.equal(invocation.shell, true);
    assert.deepEqual(invocation.args, command.slice(1));
    assert.ok(!invocation.args.some((value) => value.includes('page.tsx')));
  }
  assert.equal(resolvePrePushCommand(['pnpm', 'lint'], { platform: 'linux' }).shell, false);
});

test('rejects dynamic shell commands and unsafe scoped Prettier modes', () => {
  assert.throws(() =>
    resolvePrePushCommand(['pnpm', '--filter', 'apps/web & whoami', 'lint'], {
      platform: 'win32',
    }),
  );
  assert.throws(() =>
    resolvePrePushCommand(['pnpm', 'exec', 'prettier', '--write', '--', 'src/a.ts'], {
      platform: 'win32',
    }),
  );
  assert.throws(() => resolvePrePushCommand(['cmd.exe', '/c', 'echo bad']));
});

test('runner preserves literal filenames and fails closed on subprocess errors', () => {
  const filename = 'docs/a & echo NEVER_EXECUTED.md';
  const plan = createPrePushPlan({ full: false, files: [filename] });
  const calls = [];
  runPrePushChecks(plan, {
    platform: 'win32',
    nodeExecutable: 'C:/node.exe',
    spawn: (file, args, options) => {
      calls.push({ file, args, options });
      return { status: 0 };
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].args.at(-1), filename);

  assert.throws(() =>
    runPrePushChecks(plan, {
      platform: 'win32',
      spawn: () => ({ status: 1 }),
    }),
  );
  assert.throws(() =>
    runPrePushChecks(plan, {
      platform: 'win32',
      spawn: () => ({ error: new Error('ENOENT'), status: null }),
    }),
  );
});

/** Report-only parity probe: never execute lint/typecheck or replace the hook. */
test.each([
  ['Web', 'apps/web/src/app/page.tsx'],
  ['API', 'apps/api/src/main.ts'],
  ['Mobile', 'apps/mobile/app/index.tsx'],
  ['shared UI', 'packages/ui-web/src/index.ts'],
  ['API client', 'packages/api-client/src/generated/schema.d.ts'],
  ['i18n', 'packages/i18n/src/index.ts'],
])('Turbo explicit task dry-run preserves %s scoped validation', (_label, path) => {
  const plan = createPrePushPlan({ full: false, files: [path] });
  assert.equal(plan.scopes.full, false);
  const tasks = plan.commands
    .filter((command) => command[1] === '--filter' && ['lint', 'typecheck'].includes(command[3]))
    .map((command) => command[2] + '#' + command[3])
    .sort();
  assert.ok(tasks.length > 0);

  const root = fileURLToPath(new URL('../', import.meta.url));
  const turbo = fileURLToPath(new URL('../node_modules/turbo/bin/turbo', import.meta.url));
  const output = execFileSync(
    process.execPath,
    [
      turbo,
      'run',
      ...tasks,
      '--only',
      '--env-mode=loose',
      '--cache=local:,remote:',
      '--concurrency=1',
      '--dry=json',
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  const report = JSON.parse(output);
  assert.equal(report.envMode, 'loose');
  assert.deepEqual(report.tasks.map((task) => task.taskId).sort(), tasks);
  for (const task of report.tasks) {
    assert.ok(task.command && task.command !== '<NONEXISTENT>', task.taskId);
  }
});
