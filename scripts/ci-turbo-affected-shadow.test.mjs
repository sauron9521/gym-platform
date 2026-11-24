import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import {
  changedPathsBetween,
  compareAffectedPlans,
  chooseHistorySamples,
  historyChangeCategory,
  inspectHistoricalAffected,
  resolveAuditRange,
} from './ci-turbo-affected-shadow.mjs';

const apps = [
  '@gym/admin',
  '@gym/api',
  '@gym/api-client',
  '@gym/landing',
  '@gym/mobile',
  '@gym/trainer',
  '@gym/web',
];
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

test.each(changedCases)(
  '%s: shadow comparator reflects conservative CI scopes',
  (_name, paths, expected) => {
    const result = compareAffectedPlans(paths, plan(expected));
    assert.deepEqual(result.requiredPackages, expected);
    assert.deepEqual(result.missingFromTurbo, []);
    assert.deepEqual(result.extraAppPackages, []);
    assert.equal(result.status, 'no-missing-workspaces');
  },
);

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
  const result = compareAffectedPlans(
    ['apps/web/src/app/page.tsx'],
    plan(['@gym/web', '@gym/admin']),
  );
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
  assert.deepEqual(
    calls.map(({ args }) => args),
    [
      ['merge-base', '--is-ancestor', base, head],
      ['diff', '--name-only', '-z', '--no-renames', base + '...' + head],
    ],
  );
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
  const workflow = readFileSync(
    new URL('../.github/workflows/tooling-audit.yml', import.meta.url),
    'utf8',
  );
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

test('manual audit defaults to the latest main commit when no SHA inputs are provided', () => {
  const previous = 'a'.repeat(40);
  const current = 'b'.repeat(40);
  const calls = [];
  const git = (_command, args) => {
    calls.push(args);
    return args[0] === 'rev-parse' ? (args[1] === 'HEAD' ? current + '\n' : previous + '\n') : '';
  };
  assert.deepEqual(resolveAuditRange({}, git), {
    base: previous,
    head: current,
    mode: 'latest-main-commit',
  });
  assert.deepEqual(calls, [
    ['rev-parse', 'HEAD'],
    ['rev-parse', 'HEAD^1'],
    ['merge-base', '--is-ancestor', previous, current],
    ['merge-base', '--is-ancestor', current, current],
  ]);
});

test('manual audit accepts full SHA pairs only on the checked-out main history', () => {
  const base = 'a'.repeat(40);
  const head = 'b'.repeat(40);
  const main = 'c'.repeat(40);
  const calls = [];
  const git = (_command, args) => {
    calls.push(args);
    return args[0] === 'rev-parse' ? main + '\n' : '';
  };
  assert.deepEqual(resolveAuditRange({ AUDIT_BASE_SHA: base, AUDIT_HEAD_SHA: head }, git), {
    base,
    head,
    mode: 'explicit-main-history',
  });
  assert.deepEqual(calls, [
    ['rev-parse', 'HEAD'],
    ['merge-base', '--is-ancestor', base, head],
    ['merge-base', '--is-ancestor', head, main],
  ]);
});

test('incomplete, malformed and empty history ranges fail before a Turbo plan can run', () => {
  const base = 'a'.repeat(40);
  const head = 'b'.repeat(40);
  const main = 'c'.repeat(40);
  const git = (_command, args) => (args[0] === 'rev-parse' ? main + '\n' : '');
  assert.throws(() => resolveAuditRange({ AUDIT_BASE_SHA: base }, git), /both/);
  assert.throws(() => resolveAuditRange({ AUDIT_HEAD_SHA: head }, git), /both/);
  assert.throws(
    () => resolveAuditRange({ AUDIT_BASE_SHA: 'HEAD~3', AUDIT_HEAD_SHA: head }, git),
    /40-character/,
  );
  assert.throws(
    () => resolveAuditRange({ AUDIT_BASE_SHA: head, AUDIT_HEAD_SHA: head }, git),
    /at least one/,
  );
  assert.throws(
    () => resolveAuditRange({ AUDIT_BASE_SHA: base, AUDIT_HEAD_SHA: 'a; rm -rf' }, git),
    /40-character/,
  );
  const failsAncestry = (_command, args) => {
    if (args[0] === 'merge-base') throw new Error('Not an ancestor of main');
    return main + '\n';
  };
  assert.throws(
    () => resolveAuditRange({ AUDIT_BASE_SHA: base, AUDIT_HEAD_SHA: head }, failsAncestry),
    /ancestor/,
  );
  assert.throws(() => resolveAuditRange({}, () => 'broken'), /40-character/);
});

test('workflow sanitizes optional inputs in environment variables without shell interpolation', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/tooling-audit.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /base_sha:/);
  assert.match(workflow, /head_sha:/);
  assert.match(workflow, /AUDIT_BASE_SHA: \$\{\{ inputs\.base_sha \}\}/);
  assert.match(workflow, /AUDIT_HEAD_SHA: \$\{\{ inputs\.head_sha \}\}/);
  assert.match(workflow, /--resolve-range --github-output "\$GITHUB_OUTPUT"/);
  assert.match(workflow, /TURBO_SCM_BASE: \$\{\{ steps\.comparison-range\.outputs\.base \}\}/);
  assert.match(workflow, /TURBO_SCM_HEAD: \$\{\{ steps\.comparison-range\.outputs\.head \}\}/);
  assert.doesNotMatch(workflow, /base="\$\(\s*git rev-parse HEAD\^1\s*\)"/);
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(ci, /comparison-range|AUDIT_BASE_SHA|resolveAuditRange/);
});

test('historical samples represent distinct concrete change categories', () => {
  const c = (number) => number.toString(16).padStart(40, '0');
  const candidate = (number, paths) => ({
    base: c(number - 1),
    head: c(number),
    paths,
  });
  const selected = chooseHistorySamples(
    [
      candidate(10, ['scripts/check-workspace-boundaries.mjs']),
      candidate(9, ['apps/web/src/index.tsx']),
      candidate(8, ['apps/web/src/second.tsx']),
      candidate(7, ['docs/README.md']),
      candidate(6, ['apps/api/openapi/openapi.json']),
      candidate(5, ['packages/ui-web/src/index.ts', 'apps/mobile/src/index.ts']),
    ],
    5,
  );
  assert.deepEqual(
    selected.map(({ category }) => category),
    ['cross-cutting', 'web', 'docs', 'openapi', 'mixed'],
  );
  assert.deepEqual(
    selected.map(({ head }) => head),
    [10, 9, 7, 6, 5].map(c),
  );
  assert.equal(historyChangeCategory(['pnpm-lock.yaml']), 'lockfile');
  assert.equal(historyChangeCategory(['packages/i18n/src/messages/uk.json']), 'i18n');
  assert.equal(historyChangeCategory([]), 'empty');
});

test('historical sampling rejects invalid limits and malformed candidate revisions', () => {
  for (const count of [0, 9, -1, 1.5, '2']) {
    assert.throws(() => chooseHistorySamples([], count), /limit/);
  }
  assert.throws(() => chooseHistorySamples([{}], 1), /historical commit/);
  assert.throws(() => historyChangeCategory([null]), /historical path/);
});

test('historical shadow analysis runs only bounded Turbo dry plans on main', () => {
  const current = 'c'.repeat(40);
  const middle = 'b'.repeat(40);
  const older = 'a'.repeat(40);
  const calls = [];
  const execute = (cmd, args, options) => {
    calls.push({ cmd, args, options });
    if (cmd === 'pnpm') {
      assert.deepEqual(args, [
        'exec',
        'turbo',
        'run',
        'lint',
        'typecheck',
        'build',
        '--affected',
        '--dry=json',
      ]);
      const name = options.env.TURBO_SCM_HEAD === current ? '@gym/web' : '@gym/api';
      return JSON.stringify(plan([name]));
    }
    if (args[0] === 'rev-parse') return current + '\n';
    if (args[0] === 'rev-list') return [current, middle, older].join('\n') + '\n';
    if (args[0] === 'merge-base') return '';
    if (args[0] === 'diff') {
      return args[args.length - 1] === middle + '...' + current
        ? 'apps/web/src/page.tsx\0'
        : 'apps/api/src/main.ts\0';
    }
    throw new Error('unexpected command');
  };
  const report = inspectHistoricalAffected(2, execute, { GITHUB_REF: 'refs/heads/main' });
  assert.equal(report.mainHead, current);
  assert.equal(report.examinedFirstParentCommits, 2);
  assert.deepEqual(
    report.samples.map((x) => x.category),
    ['web', 'api'],
  );
  assert.deepEqual(
    report.samples.map((x) => x.missingFromTurbo),
    [[], []],
  );
  const turbo = calls.filter((call) => call.cmd === 'pnpm');
  assert.equal(turbo.length, 2);
  assert.deepEqual(
    turbo.map((call) => [call.options.env.TURBO_SCM_BASE, call.options.env.TURBO_SCM_HEAD]),
    [
      [middle, current],
      [older, middle],
    ],
  );
  assert.ok(report.note.includes('Advisory only'));
});

test('historical sampling refuses unsafe CLI input, non-main refs and untrusted history', () => {
  const git = () => 'a'.repeat(40) + '\n';
  for (const value of [0, 9, '0', '2; echo unsafe', 'NaN']) {
    assert.throws(
      () => inspectHistoricalAffected(value, git, { GITHUB_REF: 'refs/heads/main' }),
      /HISTORY_SAMPLES/,
    );
  }
  assert.throws(
    () => inspectHistoricalAffected(1, git, { GITHUB_REF: 'refs/heads/feature' }),
    /main branch/,
  );
  assert.throws(
    () => inspectHistoricalAffected(1, git, { GITHUB_REF: 'refs/heads/main' }),
    /first-parent main history/,
  );
});

test('manual history sampling is opt-in and cannot replace required CI gates', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/tooling-audit.yml', import.meta.url),
    'utf8',
  );
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /history_samples:/);
  assert.match(workflow, /default: 0/);
  assert.match(workflow, /if: \$\{\{ inputs\.history_samples > 0 \}\}/);
  assert.match(workflow, /HISTORY_SAMPLES: \$\{\{ inputs\.history_samples \}\}/);
  assert.match(workflow, /--history --count "\$HISTORY_SAMPLES"/);
  assert.match(workflow, /turbo-affected-history\.json/);
  assert.doesNotMatch(ci, /history_samples|turbo-affected-history/);
  assert.match(ci, /node scripts\/ci-select\.mjs --github-output/);
});
