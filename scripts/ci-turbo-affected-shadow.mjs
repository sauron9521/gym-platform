import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
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

function main(args = process.argv.slice(2)) {
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
