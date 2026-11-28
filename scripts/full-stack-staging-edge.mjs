// Disposable local-CA HTTPS against the real stack, never public DNS or ports.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { startSyntheticMonitor } from './full-stack-synthetic-monitor.mjs';
import { baseImage } from './full-stack-release.mjs';

const caddy =
  'caddy:2-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0';
export const routes = {
  'landing.rehearsal.invalid': 'landing',
  'app.rehearsal.invalid': 'web',
  'coach.rehearsal.invalid': 'trainer',
  'admin.rehearsal.invalid': 'admin',
  'api.rehearsal.invalid': 'api',
};
export function edgeConfig() {
  return (
    '{\n  admin off\n  local_certs\n  auto_https disable_redirects\n  servers {\n    strict_sni_host on\n  }\n}\n' +
    Object.entries(routes)
      .map(
        ([host, service]) =>
          host +
          ' {\n  @private path_regexp (?i)^/(backend/)?internal(/|$)\n  respond @private 404\n  reverse_proxy ' +
          service +
          ':3000\n}\n',
      )
      .join('')
  );
}
const probe = String.raw`
const assert=require('node:assert/strict');
const https=require('node:https'),fs=require('node:fs');
const ca=fs.readFileSync('/tmp/edge-ca.crt');
const get=(host,path)=>new Promise((resolve,reject)=>{
  const req=https.request({hostname:'edge',port:443,servername:host,ca,headers:{host},path,timeout:12000},res=>{
    let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
  });
  req.on('timeout',()=>req.destroy(new Error('timeout')));req.on('error',reject);req.end();
});
(async()=>{
  const mode=process.argv[1];
  if(mode==='initial'){
    for(const [host,path] of [['landing','/uk'],['app','/login'],['coach','/login'],['admin','/sign-in']]){
      const r=await get(host+'.rehearsal.invalid',path);
      assert.equal(r.status,200);assert.match(r.body,/<html/);
      if(host!=='landing'){
        const ready=await get(host+'.rehearsal.invalid','/backend/health/ready');
        assert.equal(ready.status,200);assert.equal(JSON.parse(ready.body).status,'ok');
        assert.equal((await get(host+'.rehearsal.invalid','/backend/internal/metrics')).status,404);
      }
    }
    assert.equal((await get('api.rehearsal.invalid','/internal/metrics')).status,404);
    assert.equal((await get('api.rehearsal.invalid','/users/me')).status,401);
    assert.equal((await get('app.rehearsal.invalid','/backend/users/me')).status,401);
    assert.equal((await get('admin.rehearsal.invalid','/backend/auth/admin-session')).status,401);
  }
  const live=await get('api.rehearsal.invalid','/health/live');
  assert.equal(live.status,200);
  const ready=await get('api.rehearsal.invalid','/health/ready');
  assert.equal(ready.status,mode==='redis-down'?503:200);
  if(mode!=='redis-down')assert.equal(JSON.parse(ready.body).status,'ok');
})().catch(e=>{console.error(e.message);process.exit(1)});
`;
export async function probeStagingEdge({ project, directory, compose, options }) {
  const docker = (...args) =>
    execFileSync('docker', args, {
      ...options,
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const path = join(directory, 'Caddyfile');
  writeFileSync(path, edgeConfig(), { mode: 0o600 });
  const ids = [];
  try {
    const edge = docker(
      'run',
      '-d',
      '--network',
      project + '_default',
      '--network-alias',
      'edge',
      ...Object.keys(routes).flatMap((host) => ['--network-alias', host]),
      '-v',
      path + ':/etc/caddy/Caddyfile:ro',
      caddy,
    );
    ids.push(edge);
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
    const check = (mode) => docker('exec', client, 'node', '-e', probe, mode);
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        const ca = join(directory, 'root.crt');
        docker('cp', edge + ':/data/caddy/pki/authorities/local/root.crt', ca);
        docker('cp', ca, client + ':/tmp/edge-ca.crt');
        check('initial');
        ready = true;
        break;
      } catch {
        await sleep(1000);
      }
    }
    assert.ok(ready, 'Local CA HTTPS or anonymous boundary probes failed');
    const monitor = startSyntheticMonitor({ project, directory, docker, ids, client });
    await monitor('initial');
    compose('stop', 'redis');
    let failedClosed = false;
    for (let i = 0; i < 12; i++) {
      try {
        check('redis-down');
        failedClosed = true;
        break;
      } catch {
        await sleep(1000);
      }
    }
    assert.ok(failedClosed, 'Readiness did not fail closed on Redis loss');
    await monitor('redis-down');
    compose('up', '-d', '--no-build', '--wait', '--wait-timeout', '120', 'redis');
    let recovered = false;
    for (let i = 0; i < 20; i++) {
      try {
        check('recovered');
        recovered = true;
        break;
      } catch {
        await sleep(1000);
      }
    }
    assert.ok(recovered, 'API readiness did not recover after Redis restart');
    await monitor('recovered');
    console.log(
      'Synthetic monitoring PASS: nine real HTTPS probes; Redis loss isolates four readiness failures; all recover.',
    );
    console.log(
      'Local TLS routes, anonymous session denial, internal metrics denial, Redis readiness failure and recovery PASS',
    );
  } finally {
    for (const id of ids.reverse()) docker('rm', '-f', '-v', id);
  }
}
