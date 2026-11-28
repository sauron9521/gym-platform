import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { journeys, rehearsalMonitoringConfig } from './full-stack-synthetic-monitor.mjs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('synthetic inventory has nine fixed non-secret journeys and stable bounded labels', () => {
  const config = read('ops/monitoring/synthetic/prometheus.yml');
  assert.deepEqual(
    [...config.matchAll(/labels: \{ journey: ([a-z_]+) \}/g)].map((m) => m[1]),
    journeys,
  );
  assert.equal((config.match(/targets: \['https:\/\//g) || []).length, 9);
  assert.match(config, /source_labels: \[journey\]\s+target_label: instance/);
  assert.match(config, /metric_relabel_configs:/);
  assert.doesNotMatch(config, /authorization:|bearer_token|basic_auth|\/internal\/metrics/);
  const blackbox = read('ops/monitoring/synthetic/blackbox.yml');
  assert.match(blackbox, /valid_status_codes: \[200\]/);
  assert.match(blackbox, /follow_redirects: false/);
  assert.match(blackbox, /fail_if_not_ssl: true/);
  assert.match(blackbox, /insecure_skip_verify: false/);
});
test('rehearsal uses same inventory but exclusively synthetic hostnames and verified private CA', () => {
  const { prom, bb } = rehearsalMonitoringConfig();
  assert.doesNotMatch(prom, /ovranto\.com/);
  const urls = [...prom.matchAll(/https:\/\/([^/]+)\//g)].map((m) => m[1]);
  assert.equal(urls.length, 9);
  assert.ok(urls.every((host) => host.endsWith('.rehearsal.invalid')));
  assert.match(bb, /ca_file: \/etc\/blackbox\/ca.crt/);
  assert.match(bb, /insecure_skip_verify: false/);
  const script = read('scripts/full-stack-synthetic-monitor.mjs');
  assert.match(script, /prom\/blackbox-exporter@sha256:[a-f0-9]{64}/);
  assert.match(script, /prom\/prometheus:v3\.16\.0@sha256:[a-f0-9]{64}/);
  assert.match(script, /65534:65534/);
  assert.match(script, /--cap-drop/);
  assert.doesNotMatch(script, /docker\.sock|--privileged|--publish/);
  const edge = read('scripts/full-stack-staging-edge.mjs');
  assert.ok(edge.indexOf("await monitor('initial')") < edge.indexOf("compose('stop', 'redis')"));
  assert.ok(edge.indexOf("await monitor('redis-down')") < edge.indexOf("compose('up', '-d'"));
  assert.match(edge, /await monitor\('recovered'\)/);
});
test('rules cover every absent journey and Grafana uses only the stable synthetic labels', () => {
  const rules = read('ops/monitoring/synthetic/synthetic.rules.yml');
  for (const j of journeys) assert.ok(rules.includes('journey="' + j + '",instance="' + j + '"'));
  assert.match(rules, /OvrantoSyntheticScrapeFailed/);
  assert.match(rules, /OvrantoSyntheticCertificateExpiring/);
  assert.match(read('.github/workflows/ci.yml'), /\/rules\/synthetic\/synthetic.test.yml/);
  const dashboard = JSON.parse(read('ops/monitoring/grafana/ovranto-synthetic-overview.json'));
  assert.equal(dashboard.panels.length, 4);
  for (const panel of dashboard.panels)
    assert.ok(panel.targets.every((t) => t.expr.includes('job="ovranto-synthetic"')));
});
