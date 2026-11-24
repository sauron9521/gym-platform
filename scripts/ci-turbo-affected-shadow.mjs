import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyChangedPaths } from './ci-select.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const commitSha = /^[a-f0-9]{40}$/i;
const tasksToCompare = new Set(['lint', 'typecheck', 'build']);
const applicationPackages = Object.freeze({
  api: '@gym/api',
  web: '@gym/web',
  landing: '@gym/landing',
  admin: '@gym/admin',
  trainer: '@gym/trainer',
  mobile: '@gym/mobile',
  client: '@gym/api-client',
});

/**
 * Report, never route CI. Turborepo's dry-run task graph is NOT equivalent
 * to mandatory API E2E, release, security or branch-protected result gates.
 */
export function compareAffectedPlans(paths, plan) {
  if (
    !Array.isArray(paths) ||
    paths.some((path) => typeof path !== 'string' || !path.trim()) ||
    !Array.isArray(plan?.tasks)
  ) {
    throw new Error('Invalid changed paths or Turborepo dry-run plan');
  }

  const observed = new Set();
  for (const task of plan.tasks) {
    if (
      !task ||
      typeof task.task !== 'string' ||
      typeof task.package !== 'string' ||
      !task.package.trim()
    ) {
      throw new Error('Invalid task in Turborepo dry-run plan');
    }
    if (tasksToCompare.has(task.task)) observed.add(task.package);
  }

  const selected = classifyChangedPaths(paths);
  const requiredPackages = Object.entries(applicationPackages)
    .filter(([scope]) => selected.full || selected[scope])
    .map(([, name]) => name)
    .sort();
  const turboPackages = [...observed].sort();
  const missingFromTurbo = requiredPackages.filter((name) => !observed.has(name));
  const selectorPackageSet = new Set(requiredPackages);
  const extraAppPackages = Object.values(applicationPackages)
    .filter((name) => observed.has(name) && !selectorPackageSet.has(name))
    .sort();

  return {
    changedPaths: [...paths].sort(),
    ciSelection: selected,
    requiredPackages,
    turboPackages,
    missingFromTurbo,
    extraAppPackages,
    status: missingFromTurbo.length ? 'review-required' : 'no-missing-workspaces',
    limitation:
      'Informational only: Turbo lint/typecheck/build tasks cannot replace required CI, API E2E, security, release or protected result gates.',
  };
}

/**
 * Validate read-only manual comparison ranges before giving them to Turbo.
 * By default compare HEAD^1..HEAD; optional SHAs must form a nonempty range
 * reachable from the checked-out main commit, never an untrusted branch.
 */
export function resolveAuditRange(env = process.env, git = execFileSync) {
  const requestedBase = (env.AUDIT_BASE_SHA ?? '').trim();
  const requestedHead = (env.AUDIT_HEAD_SHA ?? '').trim();
  if (Boolean(requestedBase) !== Boolean(requestedHead)) {
    throw new Error('Supply both AUDIT_BASE_SHA and AUDIT_HEAD_SHA, or neither');
  }

  const gitOptions = { cwd: repositoryRoot, encoding: 'utf8' };
  const mainHead = git('git', ['rev-parse', 'HEAD'], gitOptions).trim();
  const head = requestedHead || mainHead;
  const base = requestedBase || git('git', ['rev-parse', 'HEAD^1'], gitOptions).trim();

  if (!commitSha.test(mainHead) || !commitSha.test(base) || !commitSha.test(head)) {
    throw new Error('Comparison requires full 40-character commit SHAs');
  }
  if (base === head) throw new Error('Comparison range must contain at least one commit');

  git('git', ['merge-base', '--is-ancestor', base, head], gitOptions);
  git('git', ['merge-base', '--is-ancestor', head, mainHead], gitOptions);

  return { base, head, mode: requestedBase ? 'explicit-main-history' : 'latest-main-commit' };
}

export function changedPathsBetween(base, head, git = execFileSync) {
  if (!commitSha.test(base) || !commitSha.test(head)) {
    throw new Error('Expected full hexadecimal base/head Git SHAs');
  }

  // Reject shallow or unrelated Git histories instead of accepting a bogus
  // affected plan or treating an unresolvable comparison as a safe skip.
  git('git', ['merge-base', '--is-ancestor', base, head], { cwd: repositoryRoot });
  return git('git', ['diff', '--name-only', '-z', '--no-renames', base + '...' + head], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean);
}

const historyCategoryMatchers = [
  ['openapi', /^apps\/api\/openapi\//],
  ['api-client', /^packages\/api-client\//],
  ['ui-web', /^packages\/ui-web\//],
  ['i18n', /^packages\/i18n\//],
  ['design-tokens', /^packages\/design-tokens\//],
  ['api', /^apps\/api\//],
  ['web', /^apps\/web\//],
  ['landing', /^apps\/landing\//],
  ['admin', /^apps\/admin\//],
  ['trainer', /^apps\/trainer\//],
  ['mobile', /^apps\/mobile\//],
];

/** Choose distinct real change classes, not just several consecutive tooling commits. */
export function historyChangeCategory(paths) {
  if (!Array.isArray(paths) || !paths.length) return 'empty';
  const kinds = new Set();
  for (const path of paths) {
    if (typeof path !== 'string' || !path) throw new Error('Invalid historical path');
    if (path === 'pnpm-lock.yaml') {
      kinds.add('lockfile');
    } else if (path.startsWith('docs/') || path.endsWith('.md')) {
      continue;
    } else {
      kinds.add(
        historyCategoryMatchers.find(([, pattern]) => pattern.test(path))?.[0] ?? 'cross-cutting',
      );
    }
  }
  return kinds.size > 1 ? 'mixed' : (kinds.values().next().value ?? 'docs');
}

export function chooseHistorySamples(candidates, limit) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 8 || !Array.isArray(candidates)) {
    throw new Error('Historical sample limit must be an integer from 1 to 8');
  }
  const seen = new Set();
  const selected = [];
  for (const candidate of candidates) {
    if (!commitSha.test(candidate?.head) || !commitSha.test(candidate?.base)) {
      throw new Error('Invalid historical commit SHA');
    }
    const category = historyChangeCategory(candidate.paths);
    if (category === 'empty' || seen.has(category)) continue;
    seen.add(category);
    selected.push({ ...candidate, category });
    if (selected.length >= limit) break;
  }
  return selected;
}

/**
 * One opt-in, read-only run can sample distinct first-parent change classes.
 * Turbo is invoked with --dry=json; no build, lint or typecheck tasks run.
 */
export function inspectHistoricalAffected(count, run = execFileSync, env = process.env) {
  if (!/^[1-8]$/.test(String(count))) {
    throw new Error('HISTORY_SAMPLES must be a number from 1 to 8');
  }
  if (env.GITHUB_REF !== 'refs/heads/main') {
    throw new Error('Historical comparison is allowed only from the main branch');
  }
  const gitOptions = { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 };
  const current = run('git', ['rev-parse', 'HEAD'], gitOptions).trim();
  if (!commitSha.test(current)) throw new Error('Invalid current main commit');
  const commits = run('git', ['rev-list', '--first-parent', '--max-count=81', 'HEAD'], gitOptions)
    .trim()
    .split('\n');
  if (commits.length < 2 || commits[0] !== current || commits.some((sha) => !commitSha.test(sha))) {
    throw new Error('Invalid first-parent main history');
  }

  const candidates = [];
  for (let i = 0; i + 1 < commits.length; i++) {
    const head = commits[i];
    const base = commits[i + 1];
    const paths = changedPathsBetween(base, head, run);
    candidates.push({ base, head, paths });
  }
  const samples = chooseHistorySamples(candidates, Number(count));
  if (!samples.length) throw new Error('No eligible historical changes found');

  const results = samples.map(({ base, head, category, paths }) => {
    const raw = run(
      'pnpm',
      ['exec', 'turbo', 'run', 'lint', 'typecheck', 'build', '--affected', '--dry=json'],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        env: { ...env, TURBO_SCM_BASE: base, TURBO_SCM_HEAD: head },
      },
    );
    return { base, head, category, ...compareAffectedPlans(paths, JSON.parse(raw)) };
  });

  return {
    schemaVersion: 1,
    mainHead: current,
    examinedFirstParentCommits: candidates.length,
    samples: results,
    note: 'Advisory only. Historical Git diffs are evaluated against the current checkout dependency graph, not their original workspace configuration. No required CI routing or gates are changed.',
  };
}

function main(args = process.argv.slice(2)) {
  if (args[0] === '--history') {
    if (args.length !== 5 || args[1] !== '--count' || args[3] !== '--output') {
      throw new Error('Usage: --history --count N --output report.json');
    }
    const report = inspectHistoricalAffected(args[2]);
    writeFileSync(args[4], JSON.stringify(report, null, 2) + '\n');
    const summary = [
      '### Advisory Turbo affected historical comparisons',
      '',
      'Current main: `' + report.mainHead.slice(0, 12) + '`',
      'Distinct sample categories: ' + report.samples.map((item) => item.category).join(', '),
      ...report.samples.map(
        (item) =>
          '- ' +
          item.category +
          ' (' +
          item.head.slice(0, 12) +
          '): ' +
          item.status +
          (item.missingFromTurbo.length ? ' — missing ' + item.missingFromTurbo.join(', ') : ''),
      ),
      '',
      'These are read-only dry-run observations, not CI routing or release eligibility.',
    ];
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
    }
    console.log(summary.join('\n'));
    return;
  }
  if (args[0] === '--resolve-range') {
    if (args.length !== 3 || args[1] !== '--github-output' || !args[2]) {
      throw new Error('Usage: --resolve-range --github-output GITHUB_OUTPUT');
    }
    const range = resolveAuditRange();
    appendFileSync(
      args[2],
      ['base=' + range.base, 'head=' + range.head, 'mode=' + range.mode].join('\n') + '\n',
    );
    console.log('Validated read-only Turbo comparison range:', JSON.stringify(range));
    return;
  }

  if (
    args.length !== 8 ||
    args[0] !== '--base' ||
    args[2] !== '--head' ||
    args[4] !== '--plan' ||
    args[6] !== '--output'
  ) {
    throw new Error(
      'Usage: ci-turbo-affected-shadow.mjs --base SHA --head SHA --plan plan.json --output report.json',
    );
  }

  const [, base, , head, , planPath, , reportPath] = args;
  const paths = changedPathsBetween(base, head);
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const report = { base, head, ...compareAffectedPlans(paths, plan) };
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log('Turbo affected shadow comparison:', JSON.stringify(report, null, 2));
  // Differences are reported, not used to gate or override ci-select.mjs.
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error('[turbo-affected-shadow]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
