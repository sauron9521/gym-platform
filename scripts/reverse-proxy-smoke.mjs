import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const caddy =
  'caddy:2-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0';
const node =
  'node:24-trixie-slim@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5';
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 || (args.length === 1 && args[0] === '--staging'),
  'Invalid smoke arguments',
);
const staging = args[0] === '--staging';
const hosts = staging
  ? {
      'staging.ovranto.com': 3002,
      'app-staging.ovranto.com': 3000,
      'coach-staging.ovranto.com': 3004,
      'admin-staging.ovranto.com': 3003,
      'api-staging.ovranto.com': 3001,
    }
  : {
      'ovranto.com': 3002,
      'app.ovranto.com': 3000,
      'coach.ovranto.com': 3004,
      'admin.ovranto.com': 3003,
      'api.ovranto.com': 3001,
    };
const firstHost = Object.keys(hosts)[0];
const source = fileURLToPath(
  new URL(
    staging ? '../infra/proxy/Caddyfile.staging' : '../infra/proxy/Caddyfile',
    import.meta.url,
  ),
);
const dir = mkdtempSync(join(tmpdir(), 'ovranto-edge-'));
const testConfig = join(dir, 'Caddyfile');
const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', timeout: 120000 }).trim();
const ids = [];
const fixture = String.raw`
const http=require('node:http');
for(const port of [3000,3001,3002,3003,3004]){
  http.createServer((req,res)=>{
    res.writeHead(200,{'content-type':'application/json','set-cookie':['__Host-sid=fixture; Path=/; Secure; HttpOnly','__Host-admin-sid=fixture; Path=/; Secure; HttpOnly']});
    res.end(JSON.stringify({port,path:req.url,headers:req.headers}));
  }).listen(port,'127.0.0.1');
}
`;
const test =
  'const hosts=' +
  JSON.stringify(hosts) +
  ';const staging=' +
  JSON.stringify(staging) +
  ';\n' +
  String.raw`
const assert=require('node:assert/strict');
const http=require('node:http'),https=require('node:https'),fs=require('node:fs');
const ca=fs.readFileSync('/tmp/edge-ca.crt');
const request=(host,path='/',secure=true,headers={},servername=host,localAddress='127.0.0.1')=>new Promise((resolve,reject)=>{
  const req=(secure?https:http).request({hostname:'127.0.0.1',localAddress,port:secure?443:80,servername,ca,headers:{host,...headers},path,timeout:5000},res=>{
    let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
  });
  req.on('timeout',()=>req.destroy(new Error('timeout')));req.on('error',reject);req.end();
});
(async()=>{
  for(const [host,port] of Object.entries(hosts)){
    const redir=await request(host,'/a?q=1',false);
    assert.equal(redir.status,308);assert.equal(redir.headers.location,'https://'+host+'/a?q=1');
    const r=await request(host,'/probe?q=1',true,{'origin':'https://'+host,'cookie':'__Host-sid=fixture','x-forwarded-for':'203.0.113.2','x-forwarded-proto':'http','x-forwarded-host':'evil.invalid','forwarded':'for=203.0.113.2','cf-connecting-ip':'203.0.113.2','x-real-ip':'203.0.113.2','true-client-ip':'203.0.113.2'});
    assert.equal(r.status,200);
    if(staging){
      const spoof={'x-forwarded-for':'127.0.0.1','cf-connecting-ip':'127.0.0.1','forwarded':'for=127.0.0.1','x-real-ip':'127.0.0.1'};
      assert.equal((await request(host,'/probe',true,spoof,host,'127.0.0.2')).status,403);
      assert.equal((await request(host,'/probe',false,spoof,host,'127.0.0.2')).status,403);
    }
    const b=JSON.parse(r.body);
    assert.equal(b.port,port);assert.equal(b.path,'/probe?q=1');
    assert.equal(b.headers.host,host);assert.equal(b.headers.origin,'https://'+host);
    assert.equal(b.headers.cookie,'__Host-sid=fixture');
    assert.equal(b.headers['x-forwarded-for'],'127.0.0.1');
    assert.equal(b.headers['x-forwarded-proto'],'https');assert.equal(b.headers['x-forwarded-host'],host);
    for(const h of ['forwarded','cf-connecting-ip','x-real-ip','true-client-ip'])assert.equal(b.headers[h],undefined);
    assert.equal(r.headers['set-cookie'].length,2);
    assert.ok(r.headers['set-cookie'].every(c=>!/Domain=/i.test(c)));
    for(const path of ['/internal','/internal/metrics','/backend/internal/metrics','/INTERNAL/metrics','/internal%2fmetrics','/backend/%69nternal/metrics','/backend//internal/metrics','/backend/./internal/metrics','/backend/x/../internal/metrics','//internal/metrics']){
      assert.equal((await request(host,path)).status,404,host+path);
    }
  }
  assert.equal((await request('unapproved.invalid','/',false)).status,421);
  assert.equal((await request('unapproved.invalid','/',true,{},Object.keys(hosts)[0])).status,421);
  await assert.rejects(request('unapproved.invalid'));
  if(staging){
    for(const host of ['ovranto.com','app.ovranto.com','coach.ovranto.com','admin.ovranto.com','api.ovranto.com']){
      assert.equal((await request(host,'/',false)).status,421);
      await assert.rejects(request(host));
    }
    console.log('Staging-only direct-peer ACL, spoof rejection and production host rejection PASS.');
  }
  console.log('Reverse proxy smoke PASS: 5 verified TLS host routes, redirects, unknown hosts, forwarded-header sanitation, cookie/Origin transport, internal path denial.');
})().catch(e=>{console.error(e);process.exit(1)});
`;
try {
  // Validate the actual candidate before exercising a local-CA-only copy.
  docker(
    'run',
    '--rm',
    '--network',
    'none',
    '-e',
    'OVRANTO_ACME_EMAIL=operator@example.test',
    '-v',
    source + ':/etc/caddy/Caddyfile:ro',
    caddy,
    'caddy',
    'validate',
    '--config',
    '/etc/caddy/Caddyfile',
    '--adapter',
    'caddyfile',
  );
  const config = readFileSync(source, 'utf8');
  assert.ok(config.startsWith('{\n'));
  writeFileSync(testConfig, staging ? config : config.replace('{\n', '{\n\tlocal_certs\n'));
  const backend = docker(
    'run',
    '-d',
    '--network',
    'none',
    '--entrypoint',
    'node',
    node,
    '-e',
    fixture,
  );
  ids.push(backend);
  const edge = docker(
    'run',
    '-d',
    '--network',
    'container:' + backend,
    '-e',
    'OVRANTO_ACME_EMAIL=operator@example.test',
    '-v',
    testConfig + ':/etc/caddy/Caddyfile:ro',
    caddy,
  );
  ids.push(edge);
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      docker('cp', edge + ':/data/caddy/pki/authorities/local/root.crt', join(dir, 'root.crt'));
      docker('cp', join(dir, 'root.crt'), backend + ':/tmp/edge-ca.crt');
      docker(
        'exec',
        backend,
        'node',
        '-e',
        "require('https').get({hostname:'127.0.0.1',servername:" +
          JSON.stringify(firstHost) +
          ',headers:{host:' +
          JSON.stringify(firstHost) +
          "},ca:require('fs').readFileSync('/tmp/edge-ca.crt')},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))",
      );
      ready = true;
      break;
    } catch {
      await sleep(1000);
    }
  }
  assert.ok(ready, 'Proxy did not start');
  console.log(docker('exec', backend, 'node', '-e', test));
} catch (error) {
  for (const id of ids) docker('logs', id);
  throw error;
} finally {
  try {
    for (const id of ids.reverse()) docker('rm', '-f', '-v', id);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
