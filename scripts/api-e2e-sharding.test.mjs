import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const config = readFileSync(
  new URL('../apps/api/vitest.config.e2e.ts', import.meta.url),
  'utf8',
);
const suite = workflow.split('  api-e2e-suite:\n')[1]?.split('\n  api-e2e:\n')[0];
const gate = workflow.split('  api-e2e:\n')[1];

test('API E2E remains a required fail-closed aggregate across both isolated shards', () => {
  assert.ok(suite);
  assert.ok(gate);
  assert.match(suite, /fail-fast: false/);
  assert.match(suite, /shard: \[1, 2\]/);
  assert.ok(suite.includes('API e2e suite / PostgreSQL 17 (shard'));
  assert.ok(suite.includes('--shard=${{ matrix.shard }}/2'));
  assert.ok(suite.includes('services:\n      postgres:'));
  assert.ok(suite.includes('      redis:'));
  assert.ok(suite.includes('TEST_DATABASE_URL:'));
  assert.match(config, /fileParallelism: false/);
  assert.ok(gate.includes('needs: [changes, api-e2e-suite, api-coverage]'));
  assert.ok(gate.includes('test "$SUITE_RESULT" = success'));
  assert.ok(gate.includes('name: API e2e / PostgreSQL 17'));
});

test('schema and contract checks run once while migrations and tests run in both shards', () => {
  assert.ok(suite);
  for (const name of [
    'Typecheck integration and HTTP e2e tests',
    'Verify generated OpenAPI contract is committed and current',
    'Rehearse isolated PostgreSQL 17 and avatar restore (disposable CI only)',
  ]) {
    const section = suite.split(`- name: ${name}\n`)[1];
    assert.ok(section, `Missing step: ${name}`);
    assert.match(section, /^        if: matrix\.shard == 1/m);
  }
  for (const name of [
    'Guard disposable test database',
    'Apply test database migrations',
    'Seed test exercise library',
    'Integration and HTTP e2e tests',
  ]) {
    const section = suite.split(`- name: ${name}\n`)[1];
    assert.ok(section, `Missing step: ${name}`);
    // Don't accidentally skip the DB setup or test run on shard 2.
    assert.doesNotMatch(section.split('\n      - name:')[0], /if: matrix\.shard == 1/);
  }
});
