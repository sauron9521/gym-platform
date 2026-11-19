import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const quality = workflow.split('  quality:\n')[1]?.split('\n  api-coverage:\n')[0];
const apiJobs = [
  ['api-operations', 'API_OPERATIONS_RESULT'],
  ['api-staging-contracts', 'API_STAGING_CONTRACTS_RESULT'],
  ['api-readiness', 'API_READINESS_RESULT'],
  ['api-migration', 'API_MIGRATION_RESULT'],
  ['api-observability', 'API_OBSERVABILITY_RESULT'],
  ['api-docker', 'API_DOCKER_RESULT'],
];

test('required Quality gate waits for every API operational job without changing check names', () => {
  assert.ok(quality, 'Required Quality job missing');
  assert.match(quality, /name: Quality \/ Node 24/);
  assert.match(quality, /if: always\(\)/);
  assert.match(quality, /API_REQUIRED: \$\{\{ needs\.changes\.outputs\.api \}\}/);
  for (const [job, status] of apiJobs) {
    assert.ok(quality.includes('      - ' + job + '\n'), job + ' must be a job dependency');
    assert.ok(
      quality.includes(status + ': \u0024{{ needs.' + job + '.result }}'),
      status + ' must be passed from needs',
    );
  }
});

test('required Quality gate fails closed for API errors and checks expected skips', () => {
  // CI tooling tests run on Ubuntu; don't require Bash on developer Windows machines.
  if (process.platform === 'win32') return;
  assert.ok(quality, 'Required Quality job missing');
  const script = quality
    .split('        run: |\n')[1]
    ?.split('\n')
    .filter((line) => line.startsWith('          '))
    .map((line) => line.slice(10))
    .join('\n');
  assert.ok(script, 'Required Quality shell script missing');

  const baseline = {
    CHANGE_DETECTION_RESULT: 'success',
    QUALITY_WORKSPACES_RESULT: 'success',
    TOOLING_CONTRACTS_RESULT: 'success',
    FULL_SCOPE: 'false',
    WINDOWS_RESULT: 'skipped',
    WEB_REQUIRED: 'false',
    WEB_E2E_RESULT: 'skipped',
    DEPS_REQUIRED: 'false',
    SECURITY_RESULT: 'skipped',
    LANDING_REQUIRED: 'false',
    LANDING_E2E_RESULT: 'skipped',
    MOBILE_REQUIRED: 'false',
    MOBILE_IOS_DEV_RESULT: 'skipped',
    API_REQUIRED: 'true',
    ...Object.fromEntries(apiJobs.map(([, status]) => [status, 'success'])),
  };
  const exitStatus = (overrides = {}) => {
    const run = spawnSync('bash', ['-c', script], {
      env: { ...process.env, ...baseline, ...overrides },
      encoding: 'utf8',
    });
    assert.equal(run.error, undefined, run.error?.message);
    return run.status;
  };

  assert.equal(exitStatus(), 0, 'passing API jobs should allow merge');
  for (const [, status] of apiJobs) {
    for (const invalid of ['failure', 'cancelled', 'skipped', '']) {
      assert.notEqual(exitStatus({ [status]: invalid }), 0, status + '=' + invalid);
    }
  }

  const skipped = Object.fromEntries(apiJobs.map(([, status]) => [status, 'skipped']));
  assert.equal(exitStatus({ API_REQUIRED: 'false', ...skipped }), 0);
  for (const [, status] of apiJobs) {
    assert.notEqual(
      exitStatus({ API_REQUIRED: 'false', ...skipped, [status]: 'success' }),
      0,
      status + ' should be skipped for non-API PRs',
    );
  }
  assert.notEqual(exitStatus({ API_REQUIRED: '' }), 0);
});
