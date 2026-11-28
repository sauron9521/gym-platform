// Local, disposable two-container proof; not a production scale-up.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { baseImage } from './full-stack-release.mjs';

const caddy =
  'caddy:2-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0';
export function replicaProxyConfig(addresses) {
  assert.equal(addresses.length, 2);
  assert.equal(new Set(addresses).size, 2);
  for (const ip of addresses) assert.match(ip, /^(?:\d{1,3}\.){3}\d{1,3}$/);
  return (
    '{\n admin off\n auto_https off\n}\n:8080 {\n @allowed {\n method GET\n path /health/ready /exercises/equipment\n }\n handle @allowed {\n reverse_proxy ' +
    addresses.map((ip) => ip + ':3000').join(' ') +
    ' {\n lb_policy round_robin\n health_uri /health/ready\n health_interval 1s\n health_timeout 2s\n lb_try_duration 3s\n lb_try_interval 250ms\n fail_duration 5s\n max_fails 1\n header_down X-Rehearsal-Upstream {http.reverse_proxy.upstream.address}\n }\n }\n handle {\n respond 404\n }\n}\n'
  );
}
const probe = String.raw`
const assert=require('node:assert/strict');
const mode=process.argv[1],addresses=JSON.parse(process.argv[2]);
async function get(path){
 const response=await fetch('http://replica-proxy:8080'+path,{redirect:'manual',signal:AbortSignal.timeout(8000)});
 const body=await response.text();return {status:response.status,upstream:response.headers.get('x-rehearsal-upstream')?.replace(/^tcp\//,''),body};
}
(async()=>{
 if(mode==='balanced'){
   const seen=new Set();
   for(let i=0;i<8;i++){const r=await get('/health/ready');assert.equal(r.status,200);assert.equal(JSON.parse(r.body).status,'ok');seen.add(r.upstream);}
   assert.deepEqual([...seen].sort(),addresses.map(ip=>ip+':3000').sort());
 }else if(mode==='quota'){
   const seen=new Set();let allowed=0,blocked=0;let body;
   for(let i=0;i<61;i++){
     const r=await get('/exercises/equipment');
     if(i<60){assert.equal(r.status,200);assert.ok(addresses.includes(r.upstream?.split(':')[0]));seen.add(r.upstream);if(body===undefined)body=r.body;else assert.equal(r.body,body);allowed++;}
     else{assert.equal(r.status,429);blocked++;}
   }
   assert.equal(seen.size,2);assert.equal(allowed,60);assert.equal(blocked,1);
 }else{
   for(let i=0;i<6;i++){const r=await get('/health/ready');assert.equal(r.status,200);assert.equal(r.upstream,addresses[0]+':3000');}
 }
 assert.equal((await get('/internal/metrics')).status,404);
})().catch(e=>{console.error(e.message);process.exit(1)});
`;

export async function probeFullStackReplicas({ project, directory, compose, output, options }) {
  assert.match(project, /^ovranto-rehearsal-[a-f0-9]{16}$/);
  const docker = (...args) =>
    execFileSync('docker', args, {
      ...options,
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const network = JSON.parse(docker('network', 'inspect', project + '_default'))[0];
  assert.equal(network.Internal, true);
  assert.equal(network.Labels['com.docker.compose.project'], project);
  const original = output('ps', '-q', 'api');
  assert.match(original, /^[a-f0-9]{12,64}$/);
  const inspect = (id) => {
    assert.match(id, /^[a-f0-9]{12,64}$/);
    const row = JSON.parse(docker('inspect', id))[0];
    assert.equal(row.Config.Labels['com.docker.compose.project'], project);
    assert.equal(row.Config.Labels['com.docker.compose.service'], 'api');
    return row;
  };
  const first = inspect(original);
  const ids = [];
  try {
    compose(
      'up',
      '-d',
      '--no-build',
      '--no-deps',
      '--scale',
      'api=2',
      '--wait',
      '--wait-timeout',
      '120',
      'api',
    );
    const replicas = output('ps', '-q', 'api').split(/\s+/);
    assert.equal(replicas.length, 2);
    assert.ok(replicas.includes(original));
    const secondId = replicas.find((id) => id !== original);
    const rows = [inspect(original), inspect(secondId)];
    assert.equal(rows[0].Image, rows[1].Image);
    assert.equal(rows[0].Image, first.Image);
    for (const row of rows) {
      assert.equal(row.State.Health.Status, 'healthy');
      assert.equal(row.Config.User, 'node');
      assert.equal(
        row.HostConfig.PortBindings === null ||
          Object.keys(row.HostConfig.PortBindings).length === 0,
        true,
      );
    }
    for (const key of ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'DATABASE_POOL_MAX']) {
      const env = rows.map((row) => row.Config.Env.find((v) => v.startsWith(key + '=')));
      assert.ok(env[0] && env[0] === env[1], 'Replicas do not share expected configuration');
    }
    const addresses = rows.map(
      (row) => row.NetworkSettings.Networks[project + '_default'].IPAddress,
    );
    const config = join(directory, 'replica-Caddyfile');
    writeFileSync(config, replicaProxyConfig(addresses), { mode: 0o600, flag: 'wx' });
    const proxy = docker(
      'run',
      '-d',
      '--network',
      project + '_default',
      '--network-alias',
      'replica-proxy',
      '--mount',
      'type=bind,src=' + config + ',dst=/etc/caddy/Caddyfile,readonly',
      caddy,
    );
    ids.push(proxy);
    const client = docker(
      'run',
      '-d',
      '--network',
      project + '_default',
      '--entrypoint',
      'node',
      baseImage,
      '-e',
      'setInterval(()=>{},1000)',
    );
    ids.push(client);
    const check = (mode, ips = addresses) =>
      docker('exec', client, 'node', '-e', probe, mode, JSON.stringify(ips));
    async function waitFor(mode, ips) {
      for (let i = 0; i < 15; i++) {
        try {
          check(mode, ips);
          return;
        } catch {
          await sleep(1000);
        }
      }
      throw new Error('Replica probe failed: ' + mode);
    }
    await waitFor('balanced');
    // Real read endpoint, actual shared anonymous rate limit. No retries of quota requests.
    check('quota');
    const db = Number(
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
        "SELECT count(*) FROM pg_stat_activity WHERE backend_type='client backend' AND datname=current_database() AND pid<>pg_backend_pid()",
      ),
    );
    const poolMax = Number(
      rows[0].Config.Env.find((v) => v.startsWith('DATABASE_POOL_MAX=')).split('=')[1],
    );
    assert.ok(
      Number.isSafeInteger(db) && db >= 2 && db <= 2 * (poolMax + 1),
      'Two-replica database budget exceeded',
    );
    docker('stop', '--time', '30', secondId);
    await waitFor('failover', [addresses[0]]);
    docker('start', secondId);
    for (let i = 0; i < 30; i++) {
      if (inspect(secondId).State.Health.Status === 'healthy') break;
      await sleep(1000);
    }
    assert.equal(inspect(secondId).State.Health.Status, 'healthy');
    // A restarted container may receive another IP. Fail closed rather than
    // accidentally probing a different upstream at the old address.
    assert.equal(
      inspect(secondId).NetworkSettings.Networks[project + '_default'].IPAddress,
      addresses[1],
    );
    await waitFor('balanced');
    console.log(
      'Two API replicas PASS: round-robin, shared Redis quota 60/61, identical catalogue responses, ' +
        db +
        ' observed DB clients, single-replica failover and recovery.',
    );
  } finally {
    for (const id of ids.reverse()) docker('rm', '-f', '-v', id);
    compose(
      'up',
      '-d',
      '--no-build',
      '--no-deps',
      '--scale',
      'api=1',
      '--wait',
      '--wait-timeout',
      '120',
      'api',
    );
    assert.equal(output('ps', '-q', 'api'), original, 'Original API must remain after scale-down');
    console.log('Replica scale-down PASS: original API retained.');
  }
}
