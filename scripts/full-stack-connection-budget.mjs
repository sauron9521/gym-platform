import assert from 'node:assert/strict';
import { calculateConnectionBudget } from './database-connection-budget.mjs';

export function probeConnectionBudget({ project, output, config }) {
  assert.match(project, /^ovranto-rehearsal-[a-f0-9]{16}$/);
  assert.equal(config.name, project);
  assert.equal(config.networks.default.internal, true);
  const query = (sql) =>
    output(
      'exec',
      '-T',
      'postgres',
      'psql',
      '-X',
      '-Atq',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'rehearsal',
      '-d',
      'gym_rehearsal',
      '-c',
      sql,
    );
  assert.equal(query('SELECT current_database()'), 'gym_rehearsal');
  // Only numeric capacity and counts; never query SQL text, addresses or credentials.
  const limits = JSON.parse(
    query(
      "SELECT json_build_object('maxConnections',current_setting('max_connections')::int,'superuserReserved',current_setting('superuser_reserved_connections')::int,'reservedConnections',current_setting('reserved_connections')::int,'roleConnectionLimit',(SELECT rolconnlimit FROM pg_roles WHERE rolname=current_user),'databaseConnectionLimit',(SELECT datconnlimit FROM pg_database WHERE datname=current_database()))",
    ),
  );
  const plan = {
    ...limits,
    providerReserved: 0,
    otherConnections: 0,
    apiReplicas: 1,
    apiPoolMax: Number(config.services.api.environment.DATABASE_POOL_MAX),
    migrationConnections: 3,
    workerConnections: 5,
    maintenanceConnections: 2,
    headroom: 10,
  };
  const budget = calculateConnectionBudget(plan);
  assert.ok(budget.fits, 'Disposable database connection budget exceeded');
  const observed = Number(
    query(
      "SELECT count(*) FROM pg_stat_activity WHERE backend_type='client backend' AND datname=current_database() AND pid<>pg_backend_pid()",
    ),
  );
  assert.ok(
    Number.isSafeInteger(observed) &&
      observed >= 0 &&
      observed <= budget.apiConnections + budget.lockConnections,
    'Unexpected disposable client count',
  );
  const exceeded = calculateConnectionBudget({
    ...plan,
    apiReplicas: budget.maximumBudgetedReplicas + 1,
  });
  assert.equal(exceeded.fits, false);
  console.log(
    'Connection budget rehearsal PASS: ' +
      JSON.stringify({
        plan,
        budget,
        observedOtherClients: observed,
        overBudgetPlanRejected: true,
      }),
  );
}
