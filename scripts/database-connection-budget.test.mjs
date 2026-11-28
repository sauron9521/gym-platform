import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { calculateConnectionBudget } from './database-connection-budget.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const example = JSON.parse(read('ops/database/connection-budget.example.json'));

test('counts every process allowance and a dedicated lock per API replica', () => {
  assert.deepEqual(calculateConnectionBudget(example), {
    usable: 97,
    apiConnections: 10,
    lockConnections: 1,
    fixed: 20,
    required: 31,
    remaining: 66,
    maximumBudgetedReplicas: 7,
    fits: true,
  });
  const two = calculateConnectionBudget({ ...example, apiReplicas: 2 });
  assert.equal(two.required, 42);
  assert.equal(two.lockConnections, 2);
});
test('uses the most restrictive server, role or database limit and rejects overcommit', () => {
  const r = calculateConnectionBudget({
    ...example,
    roleConnectionLimit: 40,
    databaseConnectionLimit: 30,
  });
  assert.equal(r.usable, 30);
  assert.equal(r.remaining, -1);
  assert.equal(r.fits, false);
  assert.equal(r.maximumBudgetedReplicas, 0);
  const exact = calculateConnectionBudget({ ...example, roleConnectionLimit: 31 });
  assert.equal(exact.remaining, 0);
  assert.equal(exact.fits, true);
  assert.equal(
    calculateConnectionBudget({ ...example, providerReserved: 10, otherConnections: 5 }).remaining,
    51,
  );
});
test('rejects incomplete or unsafe inputs; reservations are never implicitly zero', () => {
  for (const invalid of [
    { ...example, apiPoolMax: 51 },
    { ...example, apiReplicas: 0 },
    { ...example, apiPoolMax: '10' },
    { ...example, headroom: 0 },
    { ...example, migrationConnections: 0 },
    { ...example, maintenanceConnections: 0 },
    { ...example, roleConnectionLimit: -2 },
    { ...example, maxConnections: 3 },
    { ...example, providerReserved: 100 },
    { ...example, otherConnections: 1.2 },
    { ...example, extra: 1 },
    Object.fromEntries(Object.entries(example).filter(([key]) => key !== 'workerConnections')),
  ])
    assert.throws(() => calculateConnectionBudget(invalid));
});
test('local rehearsal observes aggregate counts only and uses actual server limits', () => {
  const script = read('scripts/full-stack-connection-budget.mjs');
  assert.match(script, /current_setting\('max_connections'\)/);
  assert.match(script, /rolconnlimit/);
  assert.match(script, /datconnlimit/);
  assert.match(script, /pg_stat_activity/);
  assert.match(script, /backend_type='client backend'/);
  assert.doesNotMatch(script, /client_addr|query_start|pg_stat_activity\.query/);
  assert.match(
    read('scripts/full-stack-rehearsal.mjs'),
    /probeConnectionBudget\(\{ project, output, config \}\)/,
  );
});
