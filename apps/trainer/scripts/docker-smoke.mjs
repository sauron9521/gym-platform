import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const image = process.argv[2] ?? 'gym-platform-trainer:pilot';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const network = 'gym-trainer-smoke-' + randomUUID();
const ids = [];
// Synthetic HTTP fixture: transport and UI gates, not real NestJS authorization.
const fixture = String.raw`
const http = require('node:http');
http.createServer((req,res)=>{
  const send=(status,body,headers={})=>{
    res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...headers});
    res.end(JSON.stringify(body));
  };
  const path=new URL(req.url,'http://fixture').pathname;
  if(path==='/auth/login'&&req.method==='POST'){
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',()=>{
      if(!req.headers.origin || JSON.parse(body).email!=='fixture@example.test')
        return send(403,{denied:true});
      send(200,{ok:true},{'set-cookie':['pilot_session=trainer; Path=/; HttpOnly; SameSite=Lax; Secure','pilot_second=fixture; Path=/; HttpOnly; Secure']});
    });
    return;
  }
  const session=(req.headers.cookie||'').match(/(?:^|;\s*)pilot_session=([^;]+)/)?.[1];
  if(!session)return send(401,{denied:true});
  if(path==='/users/me/capabilities'){
    if(session==='malformed')return send(200,{trainer:'true'});
    if(session==='outage')return send(503,{denied:true});
    return send(200,{athlete:true,trainer:['trainer','revoked','admin'].includes(session),admin:session==='admin'});
  }
  if(session==='revoked')return send(403,{denied:true});
  if(session!=='trainer')return send(403,{denied:true});
  if(path==='/trainer-athletes')return send(200,{data:[{id:'00000000-0000-4000-8000-000000000001',status:'ACTIVE',trainerId:'fixture-trainer',athlete:{email:'private-athlete@example.test'}}],meta:{total:1,totalPages:1,take:8,skip:0}});
  if(path==='/trainer-dashboard/overview')return send(200,{asOf:'2026-11-27T12:00:00.000Z',windowStart:'2026-10-28T12:00:00.000Z',activeClients:1,activeProgramAssignments:0,completedProgramWorkouts30d:0});
  if(path==='/training-programs')return send(200,{data:[{id:'fixture-program',status:'DRAFT',versions:[{title:'Private Fixture Program'}]}],meta:{total:1,totalPages:1,take:5,skip:0}});
  send(404,{denied:true});
}).listen(3000,'0.0.0.0');
`;
docker('network', 'create', network);
try {
  ids.push(
    docker(
      'run',
      '-d',
      '--network',
      network,
      '--network-alias',
      'api',
      '--entrypoint',
      'node',
      image,
      '-e',
      fixture,
    ),
  );
  const id = docker(
    'run',
    '-d',
    '--init',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--network',
    network,
    '-p',
    '127.0.0.1::3000',
    image,
  );
  ids.push(id);
  const origin = 'http://' + docker('port', id, '3000/tcp');
  const request = (path, init = {}) =>
    fetch(origin + path, { signal: AbortSignal.timeout(5000), redirect: 'manual', ...init });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await request('/login')).status === 200) {
        ready = true;
        break;
      }
    } catch {
      /* startup */
    }
    await sleep(1000);
  }
  assert.ok(ready, 'Trainer did not become ready');
  assert.notEqual(docker('exec', id, 'id', '-u'), '0');
  const login = await request('/login', { headers: { 'accept-language': 'en' } });
  const html = await login.text();
  assert.match(html, /<html[^>]*lang="en"/);
  assert.match(html, /noindex/);
  const css = html.match(/href="(\/_next\/static\/[^"]+\.css[^"]*)"/)?.[1];
  assert.ok(css);
  assert.equal((await request(css.replaceAll('&amp;', '&'))).status, 200);
  assert.equal((await request('/backend/users/me/capabilities')).status, 401);
  const payload = JSON.stringify({ email: 'fixture@example.test' });
  assert.equal(
    (
      await request('/backend/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
      })
    ).status,
    403,
  );
  const auth = await request('/backend/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: payload,
  });
  assert.equal(auth.status, 200);
  const cookies = auth.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.ok(cookies.every((c) => /HttpOnly/i.test(c) && /Secure/i.test(c) && !/Domain=/i.test(c)));
  const cookie = cookies.map((c) => c.split(';')[0]).join('; ');
  const grants = await request('/backend/users/me/capabilities', { headers: { cookie } });
  assert.equal(grants.status, 200);
  assert.equal((await grants.json()).trainer, true);
  assert.match(grants.headers.get('cache-control') ?? '', /no-store/);
  const workspace = async (cookie = '') => {
    const res = await request('/workspace', { headers: { cookie, 'accept-language': 'en' } });
    assert.equal(res.status, 200);
    return res.text();
  };
  const approved = await workspace(cookie);
  assert.match(approved, /id="workspace-title"/);
  assert.match(approved, /private-athlete@example.test/);
  assert.match(approved, /Private Fixture Program/);
  for (const [session, title] of [
    ['', 'Sign-in required'],
    ['athlete', 'Trainer access not approved'],
    ['admin', 'Trainer access not approved'],
    ['revoked', 'Trainer access not approved'],
    ['malformed', 'Unable to verify access'],
    ['outage', 'Unable to verify access'],
  ]) {
    const page = await workspace(session ? 'pilot_session=' + session : '');
    assert.match(page, /id="workspace-access"/);
    assert.ok(page.includes(title), session + ': expected ' + title);
    assert.doesNotMatch(
      page,
      /private-athlete@example.test|Private Fixture Program|id="workspace-title"/,
    );
  }
  const bad = docker('run', '-d', '-e', 'GYM_API_INTERNAL_URL=http://wrong:3000', image);
  ids.push(bad);
  assert.equal(docker('wait', bad), '1');
  const logs = spawnSync('docker', ['logs', bad], { encoding: 'utf8' });
  assert.equal(logs.status, 0);
  assert.match(logs.stdout + logs.stderr, /Invalid fixed API origin/);
  console.log(
    'Trainer Web container smoke passed: rewrite, cookies, capability and revocation gates, noindex, assets, fixed upstream.',
  );
} catch (error) {
  for (const id of ids) console.error(docker('logs', id));
  throw error;
} finally {
  for (const id of ids.reverse()) docker('rm', '-f', id);
  docker('network', 'rm', network);
}
