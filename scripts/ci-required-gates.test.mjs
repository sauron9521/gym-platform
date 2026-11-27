import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import { classifyChangedPaths } from './ci-select.mjs';

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
  assert.ok(quality.includes('      - admin-browser-e2e\n'));
  assert.match(workflow, /admin_browser: \$\{\{ steps\.select\.outputs\.adminBrowser \}\}/);
  assert.match(quality, /ADMIN_REQUIRED: \$\{\{ needs\.changes\.outputs\.admin_browser \}\}/);
  assert.ok(quality.includes('ADMIN_E2E_RESULT: ' + '$' + '{{ needs.admin-browser-e2e.result }}'));
  assert.ok(quality.includes('      - monitoring-shadow\n'));
  assert.match(workflow, /monitoring_shadow: \$\{\{ steps\.select\.outputs\.monitoringShadow \}\}/);
  assert.match(
    quality,
    /MONITORING_SHADOW_REQUIRED: \$\{\{ needs\.changes\.outputs\.monitoring_shadow \}\}/,
  );
  assert.match(quality, /MONITORING_SHADOW_RESULT: \$\{\{ needs\.monitoring-shadow\.result \}\}/);
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

  const ordinaryApi = classifyChangedPaths([
    'apps/api/src/modules/exercises/services/exercises.service.ts',
  ]);
  const authApi = classifyChangedPaths([
    'apps/api/src/modules/auth/controllers/sessions.controller.ts',
  ]);
  assert.equal(ordinaryApi.adminBrowser, false);
  assert.equal(authApi.adminBrowser, true);

  const baseline = {
    CHANGE_DETECTION_RESULT: 'success',
    QUALITY_WORKSPACES_RESULT: 'success',
    TOOLING_CONTRACTS_RESULT: 'success',
    FULL_SCOPE: 'false',
    MONITORING_SHADOW_REQUIRED: 'false',
    MONITORING_SHADOW_RESULT: 'skipped',
    WINDOWS_RESULT: 'skipped',
    WEB_REQUIRED: 'false',
    WEB_E2E_RESULT: 'skipped',
    ADMIN_REQUIRED: String(ordinaryApi.adminBrowser),
    ADMIN_E2E_RESULT: 'skipped',
    DEPS_REQUIRED: 'false',
    SECURITY_RESULT: 'skipped',
    LANDING_REQUIRED: 'false',
    LANDING_E2E_RESULT: 'skipped',
    LANDING_DOCKER_RESULT: 'skipped',
    MOBILE_REQUIRED: 'false',
    MOBILE_IOS_DEV_RESULT: 'skipped',
    API_REQUIRED: String(ordinaryApi.api),
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

  assert.equal(exitStatus(), 0, 'ordinary API changes must allow the expected Admin skip');
  const authScope = {
    API_REQUIRED: String(authApi.api),
    ADMIN_REQUIRED: String(authApi.adminBrowser),
  };
  assert.equal(
    exitStatus({ ...authScope, ADMIN_E2E_RESULT: 'success' }),
    0,
    'successful Admin Chromium job must allow merge',
  );
  for (const invalid of ['failure', 'cancelled', 'skipped', '']) {
    assert.notEqual(
      exitStatus({ ...authScope, ADMIN_E2E_RESULT: invalid }),
      0,
      'Admin browser gate must fail closed for ' + invalid,
    );
  }
  assert.notEqual(
    exitStatus({ ADMIN_REQUIRED: 'false', ADMIN_E2E_RESULT: 'success' }),
    0,
    'unneeded Admin browser job must be skipped',
  );
  for (const [, status] of apiJobs) {
    for (const invalid of ['failure', 'cancelled', 'skipped', '']) {
      assert.notEqual(exitStatus({ [status]: invalid }), 0, status + '=' + invalid);
    }
  }

  const landingScope = { LANDING_REQUIRED: 'true', LANDING_E2E_RESULT: 'success' };
  assert.equal(exitStatus({ ...landingScope, LANDING_DOCKER_RESULT: 'success' }), 0);
  for (const invalid of ['failure', 'cancelled', 'skipped', '']) {
    assert.notEqual(exitStatus({ ...landingScope, LANDING_DOCKER_RESULT: invalid }), 0);
  }
  assert.notEqual(exitStatus({ LANDING_DOCKER_RESULT: 'success' }), 0);

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

  const shadow = classifyChangedPaths(['ops/monitoring/shadow/config.alloy']);
  assert.equal(shadow.monitoringShadow, true);
  assert.equal(shadow.api, false);
  const shadowScope = {
    API_REQUIRED: String(shadow.api),
    ...skipped,
    MONITORING_SHADOW_REQUIRED: String(shadow.monitoringShadow),
  };
  assert.equal(exitStatus({ ...shadowScope, MONITORING_SHADOW_RESULT: 'success' }), 0);
  for (const invalid of ['failure', 'cancelled', 'skipped', '']) {
    assert.notEqual(exitStatus({ ...shadowScope, MONITORING_SHADOW_RESULT: invalid }), 0);
  }
  assert.notEqual(exitStatus({ MONITORING_SHADOW_RESULT: 'success' }), 0);
  assert.notEqual(exitStatus({ MONITORING_SHADOW_REQUIRED: '' }), 0);
});
