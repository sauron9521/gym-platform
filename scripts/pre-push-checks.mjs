import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyChangedPaths } from './ci-select.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const commit = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
const zero = /^0+$/;
const formatExtension = /\.(?:[cm]?jsx?|[cm]?tsx?|jsonc?|css|scss|mdx?|ya?ml|html)$/i;

const prettierCli = fileURLToPath(
  new URL('../node_modules/prettier/bin/prettier.cjs', import.meta.url),
);

// These fixed commands are safe through cmd.exe on Windows. Git filenames
// MUST NOT be passed through that shell, even when they contain metacharacters.
const trustedPnpmCommands = new Set(
  [
    ['pnpm', 'format:check'],
    ['pnpm', 'lint'],
    ['pnpm', 'typecheck'],
    ['pnpm', '--filter', '@gym/api', 'db:generate'],
    ['pnpm', '--filter', '@gym/api', 'lint'],
    ['pnpm', '--filter', '@gym/api', 'typecheck'],
    ['pnpm', '--filter', '@gym/api-client', 'typecheck'],
    ['pnpm', '--filter', '@gym/web', 'lint'],
    ['pnpm', '--filter', '@gym/web', 'typecheck'],
    ['pnpm', '--filter', '@gym/landing', 'lint'],
    ['pnpm', '--filter', '@gym/landing', 'typecheck'],
    ['pnpm', '--filter', '@gym/admin', 'lint'],
    ['pnpm', '--filter', '@gym/admin', 'typecheck'],
    ['pnpm', '--filter', '@gym/trainer', 'lint'],
    ['pnpm', '--filter', '@gym/trainer', 'typecheck'],
    ['pnpm', '--filter', '@gym/mobile', 'lint'],
    ['pnpm', '--filter', '@gym/mobile', 'typecheck'],
  ].map((args) => JSON.stringify(args)),
);

export function parsePushRefs(stdin) {
  if (typeof stdin !== 'string' || !stdin.trim()) return null;
  const result = [];
  for (const line of stdin.trim().split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 4 || !commit.test(parts[1]) || !commit.test(parts[3])) {
      return null;
    }
    result.push({
      localRef: parts[0],
      localSha: parts[1],
      remoteRef: parts[2],
      remoteSha: parts[3],
    });
  }
  return result.length ? result : null;
}

export function findPushedPaths(
  stdin,
  {
    remote = 'origin',
    git = (args) =>
      execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      }),
  } = {},
) {
  const updates = parsePushRefs(stdin);
  // Missing input, unknown refs or failed Git lookups must not skip checks.
  if (!updates || !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(remote)) {
    return { full: true, files: [] };
  }
  const files = new Set();
  try {
    for (const update of updates) {
      if (zero.test(update.localSha)) {
        // Deleting a ref publishes no new files.
        continue;
      }
      if (update.localSha === update.remoteSha) continue;

      let base = update.remoteSha;
      if (zero.test(base)) {
        // First push of a feature branch: compare against its merge-base
        // with remote main, not the entire history of the new branch.
        const main = git(['rev-parse', '--verify', 'refs/remotes/' + remote + '/main']).trim();
        base = git(['merge-base', main, update.localSha]).trim();
        if (!commit.test(base)) throw new Error('Invalid main merge-base');
      }

      const changed = git([
        'diff',
        '--name-only',
        '-z',
        '--no-renames',
        '--diff-filter=ACMRT',
        base,
        update.localSha,
        '--',
      ]);
      for (const path of changed.split('\0').filter(Boolean)) files.add(path);
    }
  } catch {
    return { full: true, files: [] };
  }
  return { full: false, files: [...files].sort() };
}

export function createPrePushPlan({ full, files }) {
  // Valid Git ref updates with no net file changes, or only ref deletions,
  // publish no modified source and require no local checks.
  if (!full && files.length === 0) {
    return {
      scopes: {
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
      },
      commands: [],
    };
  }

  const scopes = classifyChangedPaths(files, { forceFull: full });
  const commands = [];
  if (scopes.full) {
    return {
      scopes,
      commands: [
        ['pnpm', 'format:check'],
        ['pnpm', '--filter', '@gym/api', 'db:generate'],
        ['pnpm', 'lint'],
        ['pnpm', 'typecheck'],
      ],
    };
  }

  const formatted = files.filter((path) => formatExtension.test(path));
  if (formatted.length) {
    // Avoid OS argument-size limits for exceptionally large pushes.
    if (formatted.length > 100) {
      commands.push(['pnpm', 'format:check']);
    } else {
      commands.push([
        'pnpm',
        'exec',
        'prettier',
        '--check',
        '--ignore-unknown',
        '--',
        ...formatted,
      ]);
    }
  }

  if (scopes.api) {
    commands.push(['pnpm', '--filter', '@gym/api', 'db:generate']);
    commands.push(['pnpm', '--filter', '@gym/api', 'lint']);
    commands.push(['pnpm', '--filter', '@gym/api', 'typecheck']);
  }
  if (scopes.client) commands.push(['pnpm', '--filter', '@gym/api-client', 'typecheck']);
  if (scopes.web) {
    commands.push(['pnpm', '--filter', '@gym/web', 'lint']);
    commands.push(['pnpm', '--filter', '@gym/web', 'typecheck']);
  }
  if (scopes.landing) {
    commands.push(['pnpm', '--filter', '@gym/landing', 'lint']);
    commands.push(['pnpm', '--filter', '@gym/landing', 'typecheck']);
  }
  if (scopes.admin) {
    commands.push(['pnpm', '--filter', '@gym/admin', 'lint']);
    commands.push(['pnpm', '--filter', '@gym/admin', 'typecheck']);
  }
  if (scopes.trainer) {
    commands.push(['pnpm', '--filter', '@gym/trainer', 'lint']);
    commands.push(['pnpm', '--filter', '@gym/trainer', 'typecheck']);
  }
  if (scopes.mobile) {
    commands.push(['pnpm', '--filter', '@gym/mobile', 'lint']);
    commands.push(['pnpm', '--filter', '@gym/mobile', 'typecheck']);
  }
  return { scopes, commands };
}

/**
 * Git filenames are untrusted command arguments. On Windows, pnpm resolves
 * through a .cmd shim, which requires a shell; scoped Prettier MUST instead
 * use the Node executable directly so filenames are never shell-expanded.
 */
export function resolvePrePushCommand(
  command,
  { platform = process.platform, nodeExecutable = process.execPath } = {},
) {
  if (!Array.isArray(command) || command[0] !== 'pnpm') {
    throw new Error('Unexpected pre-push command');
  }

  if (command[1] === 'exec' && command[2] === 'prettier') {
    if (
      command[3] !== '--check' ||
      command[4] !== '--ignore-unknown' ||
      command[5] !== '--' ||
      command.length < 7
    ) {
      throw new Error('Unexpected scoped Prettier arguments');
    }

    return {
      executable: nodeExecutable,
      args: [prettierCli, ...command.slice(3)],
      shell: false,
    };
  }

  // Only known, filename-free pnpm commands may use the Windows cmd shim.
  if (!trustedPnpmCommands.has(JSON.stringify(command))) {
    throw new Error('Untrusted pre-push command');
  }

  return {
    executable: 'pnpm',
    args: command.slice(1),
    shell: platform === 'win32',
  };
}

export function runPrePushChecks(
  plan,
  { spawn = spawnSync, platform = process.platform, nodeExecutable = process.execPath } = {},
) {
  console.log('[pre-push] Selected scopes:', JSON.stringify(plan.scopes));
  if (!plan.commands.length) {
    console.log('[pre-push] No changed source files need checks.');
    return;
  }
  for (const command of plan.commands) {
    const invocation = resolvePrePushCommand(command, { platform, nodeExecutable });
    console.log('[pre-push] Running:', command.join(' '));
    const result = spawn(invocation.executable, invocation.args, {
      cwd: root,
      stdio: 'inherit',
      shell: invocation.shell,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error('Pre-push check failed: ' + command.join(' '));
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const stdin = readFileSync(0, 'utf8');
    const { full, files } = findPushedPaths(stdin, {
      remote: process.argv[2] || 'origin',
    });
    runPrePushChecks(createPrePushPlan({ full, files }));
  } catch (error) {
    console.error('[pre-push]', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
