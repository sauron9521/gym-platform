const assert = require('node:assert/strict');
const { setTimeout: sleep } = require('node:timers/promises');

const base = 'http://127.0.0.1:18080';
const critical = 'GymApiDockerOOMKilled';
const warning = 'GymApiRedisOutageObserved';
async function request(path, method = 'GET') {
  const response = await fetch(base + path, { method, signal: AbortSignal.timeout(3000) });
  assert.equal(response.status, 200);
  return response;
}
async function receipts() {
  return (await request('/receipts')).json();
}
function matches(rows, receiver, name, state, code = 200) {
  return rows.filter(
    (r) =>
      r.receiver === receiver &&
      r.status === code &&
      r.alerts.some((a) => a.name === name && a.status === state),
  );
}
async function until(label, predicate, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const result = await predicate();
      if (result) return result;
    } catch (error) {
      if (error instanceof assert.AssertionError) throw error;
    }
    await sleep(500);
  }
  throw new Error('Timed out: ' + label);
}
(async () => {
  await until('Prometheus and Alertmanager ready', async () => {
    const [p, a] = await Promise.all([
      fetch('http://127.0.0.1:9090/-/ready'),
      fetch('http://127.0.0.1:9093/-/ready'),
    ]);
    return p.ok && a.ok;
  });
  await until('healthy initial scrape', async () => {
    const r = await fetch('http://127.0.0.1:9090/api/v1/query?query=gym_api_docker_oom_killed');
    const j = await r.json();
    return j.data?.result?.[0]?.value?.[1] === '0';
  });
  assert.deepEqual(await receipts(), []);
  await request('/activate', 'POST');
  await until('primary succeeds despite secondary failure', async () => {
    const rows = await receipts();
    return (
      matches(rows, 'primary-fixture', critical, 'firing').length &&
      matches(rows, 'primary-fixture', warning, 'firing').length &&
      matches(rows, 'secondary-fixture', critical, 'firing', 503).length
    );
  });
  const failed = await receipts();
  assert.equal(matches(failed, 'secondary-fixture', critical, 'firing').length, 0);
  assert.equal(
    failed.filter(
      (r) => r.receiver === 'secondary-fixture' && r.alerts.some((a) => a.name === warning),
    ).length,
    0,
  );
  await request('/recover-receiver', 'POST');
  await until(
    'secondary retries and succeeds',
    async () => matches(await receipts(), 'secondary-fixture', critical, 'firing').length,
  );
  const fired = await receipts();
  const first = matches(fired, 'primary-fixture', critical, 'firing')[0].alerts.find(
    (a) => a.name === critical,
  );
  const second = matches(fired, 'secondary-fixture', critical, 'firing')[0].alerts.find(
    (a) => a.name === critical,
  );
  assert.equal(first.severity, 'critical');
  assert.ok(first.fingerprint);
  assert.equal(first.fingerprint, second.fingerprint);
  await sleep(6000);
  const dedup = await receipts();
  for (const receiver of ['primary-fixture', 'secondary-fixture']) {
    assert.equal(matches(dedup, receiver, critical, 'firing').length, 1);
  }
  assert.equal(matches(dedup, 'primary-fixture', warning, 'firing').length, 1);
  await request('/resolve', 'POST');
  await until('resolved notifications delivered', async () => {
    const rows = await receipts();
    return (
      matches(rows, 'primary-fixture', critical, 'resolved').length &&
      matches(rows, 'secondary-fixture', critical, 'resolved').length &&
      matches(rows, 'primary-fixture', warning, 'resolved').length
    );
  });
  const final = await receipts();
  assert.equal(
    final.filter(
      (r) => r.receiver === 'secondary-fixture' && r.alerts.some((a) => a.name === warning),
    ).length,
    0,
  );
  console.log(
    'Alert delivery PASS: actual Prometheus rules, critical fanout, secondary 503 and retry, warning isolation, deduplication and resolved delivery.',
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
