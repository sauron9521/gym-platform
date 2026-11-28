import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { replicaProxyConfig } from './full-stack-replicas.mjs';

test('disposable load balancer allows only two explicit upstreams and read-only probes', () => {
  const config = replicaProxyConfig(['172.20.0.2', '172.20.0.3']);
  assert.match(config, /reverse_proxy 172\.20\.0\.2:3000 172\.20\.0\.3:3000/);
  assert.match(config, /method GET/);
  assert.match(config, /path \/health\/ready \/exercises\/equipment/);
  assert.match(config, /lb_policy round_robin/);
  assert.match(config, /health_uri \/health\/ready/);
  assert.match(config, /respond 404/);
  for (const bad of [
    [],
    ['172.20.0.2'],
    ['172.20.0.2', '172.20.0.2'],
    ['api', '172.20.0.3'],
    ['172.20.0.2', '172.20.0.3\nrespond 200'],
  ])
    assert.throws(() => replicaProxyConfig(bad));
});
test('two replicas stay within a validated disposable project and scale down before recovery', () => {
  const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const script = read('scripts/full-stack-replicas.mjs');
  assert.match(script, /network.Internal, true/);
  assert.match(script, /com\.docker\.compose\.project/);
  assert.match(script, /api=2/);
  assert.match(script, /api=1/);
  assert.match(script, /rows\[0\]\.Image, rows\[1\]\.Image/);
  assert.match(script, /REDIS_URL/);
  assert.match(script, /i<60/);
  assert.match(script, /r.status,429/);
  assert.match(script, /pg_stat_activity/);
  assert.match(script, /Original API must remain after scale-down/);
  assert.doesNotMatch(script, /--privileged|docker\.sock|--publish|docker system prune/);
  const runner = read('scripts/full-stack-rehearsal.mjs');
  assert.ok(
    runner.indexOf('await probeFullStackReplicas(') > runner.indexOf('await probeStagingEdge('),
  );
  assert.ok(
    runner.indexOf('await probeFullStackReplicas(') <
      runner.indexOf('await probeFullStackRecovery('),
  );
});
