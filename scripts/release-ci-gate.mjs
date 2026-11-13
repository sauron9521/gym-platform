#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Validate the exact-commit, main-branch, push-triggered CI workflow.
 * Caller fetches only /actions/workflows/ci.yml/runs from this repository.
 * A previous green run cannot mask a more recent failed rerun.
 */
export function requireGreenMainCi(payload, repository, sha) {
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ||
    !/^[a-f0-9]{40}$/.test(sha) ||
    !Array.isArray(payload?.workflow_runs)
  ) {
    throw new Error('Invalid release CI identity or workflow response');
  }

  const matching = payload.workflow_runs
    .filter(
      (run) =>
        run?.repository?.full_name === repository &&
        run.head_sha === sha &&
        run.head_branch === 'main' &&
        run.event === 'push' &&
        Number.isSafeInteger(run.id) &&
        run.id > 0,
    )
    .sort((a, b) => b.id - a.id);

  if (matching.length === 0) {
    throw new Error('No main push CI workflow found for the exact commit');
  }

  const latest = matching[0];
  if (latest.status !== 'completed' || latest.conclusion !== 'success') {
    throw new Error('Most recent main CI workflow did not complete successfully');
  }

  return { runId: latest.id, sourceSha: sha, verified: true };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const [path, repository, sha] = process.argv.slice(2);
    if (!path || !repository || !sha || process.argv.length !== 5) {
      throw new Error('Expected CI JSON file path, repository and source SHA');
    }
    const payload = JSON.parse(await readFile(path, 'utf8'));
    process.stdout.write(JSON.stringify(requireGreenMainCi(payload, repository, sha)) + '\n');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid main CI verification');
    process.exitCode = 1;
  }
}
