import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const prefix = 'ops/monitoring/gym-platform-api-';

test('production monitoring example matches the monorepo Docker Compose layout', async () => {
  const compose = await read('infra/docker/compose.prod.yaml');
  const forward = await read('ops/monitoring/forwarder.env.example');
  const collector = await read('ops/monitoring/monitoring.env.example');
  const resources = await read('ops/monitoring/resources.env.example');
  const signals = await read('ops/monitoring/signals.env.example');

  assert.match(compose, /^name: gym-platform-api$/m);
  assert.match(compose, /127\.0\.0\.1:\$\{API_PORT:-3001\}:3000/);
  assert.match(compose, /driver: local/);
  assert.match(forward, /^FORWARD_CONTAINER=gym-platform-api-api-1$/m);
  assert.match(resources, /^RESOURCE_CONTAINER=gym-platform-api-api-1$/m);
  assert.match(signals, /^SIGNALS_CONTAINER=gym-platform-api-api-1$/m);
  assert.match(collector, /^MONITOR_API_ORIGIN=http:\/\/127\.0\.0\.1:3001$/m);
  assert.match(collector, /^MONITOR_LOG_FILE=\/var\/log\/gym-platform-api\/events\.jsonl$/m);
  assert.match(forward, /^FORWARD_LOG_FILE=\/var\/log\/gym-platform-api\/events\.jsonl$/m);
  assert.doesNotMatch(
    forward + collector + resources + signals,
    /\/etc\/gym-api\b|gym-api-api-1|\/var\/log\/gym-api\//,
  );
});

test('host collector has no Docker access and host-forwarder remains separate', async () => {
  const monitor = await read(prefix + 'monitor.service');
  const forwarder = await read(prefix + 'forwarder.service');
  const collect = await read('scripts/monitoring-collect.sh');
  const forward = await read('scripts/monitoring-forward.sh');

  assert.match(monitor, /^User=gym-monitor$/m);
  assert.match(monitor, /^ReadOnlyPaths=\/var\/log\/gym-platform-api$/m);
  assert.match(
    monitor,
    /^ExecStart=\/usr\/bin\/bash \/opt\/gym-platform\/scripts\/monitoring-collect\.sh$/m,
  );
  assert.match(monitor, /^SuccessExitStatus=2$/m);
  assert.match(collect, /monitoring-log-window\.mjs/);
  assert.match(collect, /monitoring-textfile\.mjs/);
  assert.doesNotMatch(
    monitor + collect,
    /docker logs|docker inspect|docker stats|\/var\/run\/docker\.sock|SupplementaryGroups=docker/,
  );

  assert.match(forwarder, /^User=root$/m);
  assert.match(forwarder, /^EnvironmentFile=\/etc\/gym-platform\/forwarder\.env$/m);
  assert.match(forwarder, /^ReadWritePaths=\/var\/log\/gym-platform-api$/m);
  assert.match(forward, /docker logs --since 10m --timestamps/);
  assert.match(forward, /monitoring-docker-forwarder\.mjs/);
});

test('all collectors and timers are opt-in; no background service is enabled on merge', async () => {
  for (const name of ['forwarder', 'monitor', 'resources', 'signals']) {
    const service = await read(prefix + name + '.service');
    const timer = await read(prefix + name + '.timer');
    assert.match(service, /^Type=oneshot$/m);
    assert.match(service, /^NoNewPrivileges=true$/m);
    assert.match(service, /^ProtectSystem=strict$/m);
    assert.match(timer, new RegExp('^Unit=gym-platform-api-' + name + '\\.service$', 'm'));
    assert.doesNotMatch(service + timer, /systemctl enable|systemctl start/);
    assert.doesNotMatch(service + timer, /\/opt\/gym-api\b|\/etc\/gym-api\b/);
  }
});

test('metrics and recording rules preserve existing gym_api series names', async () => {
  const exporter = await read('scripts/monitoring-textfile.mjs');
  const rules = await read('ops/monitoring/alerts.rules.yml');
  const slo = await read('ops/monitoring/slo.rules.yml');
  const dashboard = JSON.parse(await read('ops/monitoring/grafana/gym-platform-api-overview.json'));

  assert.match(exporter, /gym_api_monitor_http_503_window_5m/);
  assert.match(exporter, /gym_api_monitor_redis_outages_window_5m/);
  assert.match(rules, /GymApiMonitoringSnapshotStale/);
  assert.match(rules, /GymApiHttp503Elevated/);
  assert.match(rules, /GymApiDockerOOMKilled/);
  assert.match(slo, /gym_api:sli:readiness_observed/);
  assert.ok(Array.isArray(dashboard.panels) && dashboard.panels.length > 0);
});

test('CI only validates monitoring offline and never enables privileged monitoring', async () => {
  const ci = await read('.github/workflows/ci.yml');
  assert.match(ci, /API Observability \/ HTTP, Redis and Docker/);
  assert.match(ci, /promtool/);
  assert.doesNotMatch(ci, /systemctl enable|systemctl start|docker compose up.*production/);
});
