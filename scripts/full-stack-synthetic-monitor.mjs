// Run the real Prometheus + Blackbox Exporter only within the disposable edge network.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const prometheus =
  'prom/prometheus:v3.16.0@sha256:e04987641b57704f408e31f6373ba4138ecf27cb4a165d24aabb6c38fddd0f06';
const blackbox =
  'prom/blackbox-exporter@sha256:a50c4c0eda297baa1678cd4dc4712a67fdea713b832d43ce7fcc5f9bea05094d';
export const journeys = [
  'landing',
  'athlete',
  'trainer',
  'admin',
  'api_live',
  'api_ready',
  'athlete_api',
  'trainer_api',
  'admin_api',
];
const config = (name) =>
  readFileSync(new URL('../ops/monitoring/synthetic/' + name, import.meta.url), 'utf8');
export function rehearsalMonitoringConfig() {
  const hosts = {
    'ovranto.com': 'landing.rehearsal.invalid',
    'app.ovranto.com': 'app.rehearsal.invalid',
    'coach.ovranto.com': 'coach.rehearsal.invalid',
    'admin.ovranto.com': 'admin.rehearsal.invalid',
    'api.ovranto.com': 'api.rehearsal.invalid',
  };
  const prom = config('prometheus.yml')
    .replace(/https:\/\/([a-z.]+)\//g, (_, host) => {
      assert.ok(Object.hasOwn(hosts, host), 'Unexpected external probe target');
      return 'https://' + hosts[host] + '/';
    })
    .replaceAll('30s', '5s')
    .replace('scrape_timeout: 10s', 'scrape_timeout: 4s');
  const bb = config('blackbox.yml')
    .replace('timeout: 8s', 'timeout: 3s')
    .replace(
      'insecure_skip_verify: false',
      'insecure_skip_verify: false\n        ca_file: /etc/blackbox/ca.crt',
    );
  return { prom, bb };
}
const queryProbe = String.raw`
const assert=require('node:assert/strict');
const expected=JSON.parse(process.argv[1]);
const state=process.argv[2];
(async()=>{
  async function query(q){
    const response=await fetch('http://synthetic-prometheus:9090/api/v1/query?query='+encodeURIComponent(q),{signal:AbortSignal.timeout(5000)});
    assert.equal(response.status,200);
    const json=await response.json();assert.equal(json.status,'success');
    return Object.fromEntries(json.data.result.map(row=>[row.metric.journey,Number(row.value[1])]));
  }
  const success=await query('probe_success{job="ovranto-synthetic"}');
  const up=await query('up{job="ovranto-synthetic"}');
  const codes=await query('probe_http_status_code{job="ovranto-synthetic"}');
  assert.deepEqual(Object.keys(success).sort(),[...expected].sort());
  for(const j of expected){
    assert.equal(up[j],1);
    const failed=state==='redis-down'&&['api_ready','athlete_api','trainer_api','admin_api'].includes(j);
    assert.equal(success[j],failed?0:1);assert.equal(codes[j],failed?503:200);
  }
})().catch(()=>process.exit(1));
`;
export function startSyntheticMonitor({ project, directory, docker, ids, client }) {
  assert.match(project, /^ovranto-rehearsal-[a-f0-9]{16}$/);
  const { prom, bb } = rehearsalMonitoringConfig();
  const files = {
    'synthetic-prometheus.yml': prom,
    'synthetic-blackbox.yml': bb,
    'synthetic.rules.yml': config('synthetic.rules.yml'),
  };
  for (const [name, content] of Object.entries(files))
    writeFileSync(join(directory, name), content, { mode: 0o644, flag: 'wx' });
  const ca = join(directory, 'root.crt');
  chmodSync(ca, 0o644);
  const common = [
    'run',
    '-d',
    '--network',
    project + '_default',
    '--user',
    '65534:65534',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--read-only',
  ];
  const bbId = docker(
    ...common,
    '--network-alias',
    'blackbox',
    '--mount',
    'type=bind,src=' +
      join(directory, 'synthetic-blackbox.yml') +
      ',dst=/etc/blackbox/config.yml,readonly',
    '--mount',
    'type=bind,src=' + ca + ',dst=/etc/blackbox/ca.crt,readonly',
    blackbox,
    '--config.file=/etc/blackbox/config.yml',
  );
  ids.push(bbId);
  const promId = docker(
    ...common,
    '--network-alias',
    'synthetic-prometheus',
    '--tmpfs',
    '/prometheus:rw,uid=65534,gid=65534,size=128m',
    '--mount',
    'type=bind,src=' +
      join(directory, 'synthetic-prometheus.yml') +
      ',dst=/etc/prometheus/prometheus.yml,readonly',
    '--mount',
    'type=bind,src=' +
      join(directory, 'synthetic.rules.yml') +
      ',dst=/etc/prometheus/synthetic.rules.yml,readonly',
    prometheus,
    '--config.file=/etc/prometheus/prometheus.yml',
    '--storage.tsdb.path=/prometheus',
    '--storage.tsdb.retention.time=1h',
  );
  ids.push(promId);
  return async (state) => {
    for (let i = 0; i < 30; i++) {
      try {
        docker('exec', client, 'node', '-e', queryProbe, JSON.stringify(journeys), state);
        return;
      } catch {
        await sleep(1000);
      }
    }
    throw new Error('Synthetic monitor did not observe expected ' + state + ' state');
  };
}
