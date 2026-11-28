// Capacity planning, not permission to deploy or increase replica count.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const keys = [
  'maxConnections',
  'superuserReserved',
  'reservedConnections',
  'providerReserved',
  'roleConnectionLimit',
  'databaseConnectionLimit',
  'otherConnections',
  'apiReplicas',
  'apiPoolMax',
  'migrationConnections',
  'workerConnections',
  'maintenanceConnections',
  'headroom',
];

function bounded(value, min, max, name) {
  assert.ok(Number.isSafeInteger(value) && value >= min && value <= max, 'Invalid ' + name);
  return value;
}

export function calculateConnectionBudget(input) {
  assert.deepEqual(Object.keys(input).sort(), [...keys].sort(), 'Exact budget fields required');
  for (const key of keys) {
    const unlimited = key === 'roleConnectionLimit' || key === 'databaseConnectionLimit';
    bounded(input[key], unlimited ? -1 : 0, 1000000, key);
  }
  bounded(input.maxConnections, 1, 1000000, 'maxConnections');
  bounded(input.apiReplicas, 1, 1000, 'apiReplicas');
  bounded(input.apiPoolMax, 1, 50, 'apiPoolMax');
  for (const key of ['migrationConnections', 'maintenanceConnections', 'headroom']) {
    bounded(input[key], 1, 1000000, key);
  }
  const serverUsable =
    input.maxConnections -
    input.superuserReserved -
    input.reservedConnections -
    input.providerReserved;
  assert.ok(serverUsable > 0, 'No usable server capacity');
  const usable = Math.min(
    serverUsable,
    ...[input.roleConnectionLimit, input.databaseConnectionLimit].filter((n) => n !== -1),
  );
  const perReplica = input.apiPoolMax + 1; // Dedicated session advisory lock outside Prisma pool.
  const apiConnections = input.apiReplicas * input.apiPoolMax;
  const lockConnections = input.apiReplicas;
  const fixed =
    input.otherConnections +
    input.migrationConnections +
    input.workerConnections +
    input.maintenanceConnections +
    input.headroom;
  const required = apiConnections + lockConnections + fixed;
  const remaining = usable - required;
  return {
    usable,
    apiConnections,
    lockConnections,
    fixed,
    required,
    remaining,
    maximumBudgetedReplicas: Math.max(0, Math.floor((usable - fixed) / perReplica)),
    fits: remaining >= 0,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.equal(
      process.argv.length,
      3,
      'Usage: node scripts/database-connection-budget.mjs PLAN.json',
    );
    const budget = calculateConnectionBudget(JSON.parse(readFileSync(process.argv[2], 'utf8')));
    console.log(JSON.stringify(budget, null, 2));
    if (!budget.fits) process.exitCode = 1;
  } catch {
    console.error('Invalid or incomplete connection budget');
    process.exitCode = 2;
  }
}
