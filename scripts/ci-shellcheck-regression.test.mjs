import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('admin staging summary appends all evidence as one group', () => {
  const workflow = read('.github/workflows/admin-staging-session-smoke.yml');
  const step = workflow.split(
    '      - name: Record status only, never secrets or session identifiers',
  )[1];
  assert.ok(step);
  assert.match(step, /run: \|\n\s+\{\n/);
  assert.match(step, /\} >> "\$GITHUB_STEP_SUMMARY"/);
  assert.equal(step.match(/>> "\$GITHUB_STEP_SUMMARY"/g)?.length, 1);
  assert.match(step, /The selected scenario was/);
  assert.match(step, /NOT production approval/);
});

test('performance preflight creates its private directory with mode 700', () => {
  const workflow = read('.github/workflows/api-performance-ab.yml');
  assert.match(workflow, /install -d -m 700 "\$RUNNER_TEMP\/gym-perf-ab"/);
  assert.match(workflow, /before after "\$BEFORE_SHA" "\$AFTER_SHA"/);
});

test('staging restart and Redis AOF rewrite preserve retry limits', () => {
  const staging = read('.github/workflows/staging-ghcr.yml');
  const redis = read('scripts/test-redis-upgrade.sh');
  assert.match(staging, /for _ in \$\(seq 1 50\); do/);
  assert.match(staging, /test "\$healthy" = 1/);
  assert.match(redis, /local _\n  for _ in \$\(seq 1 60\); do/);
  assert.match(redis, /rewrite_ok=false\nfor _ in \$\(seq 1 60\); do/);
  assert.match(redis, /test "\$rewrite_ok" = true/);
});
