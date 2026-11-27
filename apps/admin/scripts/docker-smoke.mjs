import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const image = process.argv[2] ?? 'gym-platform-admin:pilot';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const network = 'gym-admin-smoke-' + randomUUID();
const ids = [];
// Synthetic protocol fixture only. Real admin-session and MFA policy remain API-owned.
const fixture = String.raw`
const http=require('node:http');
const counts={directory:0,health:0};
http.createServer((req,res)=>{
  const send=(status,body,headers={})=>{
    res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...headers});
    res.end(JSON.stringify(body));
  };
  const path=new URL(req.url,'http://fixture').pathname;
  if(path==='/fixture-counts')return send(200,counts);
  if(path==='/auth/admin-login'&&req.method==='POST'){
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',()=>{
      if(!req.headers.origin)return send(403,{denied:true});
      const pending=JSON.parse(body).email==='mfa@example.test';
      send(200,{mfaRequired:pending},{'set-cookie':['__Host-admin-sid='+(pending?'pending':'approved')+'; Path=/; HttpOnly; SameSite=Lax; Secure']});
    });
    return;
  }
  const session=(req.headers.cookie||'').match(/(?:^|;\s*)__Host-admin-sid=([^;]+)/)?.[1];
  if(path==='/auth/admin-session'){
    if(!session||['pending','expired'].includes(session))return send(401,{denied:true});
    if(session==='athlete')return send(200,{id:'ordinary',role:'ATHLETE'});
    if(session==='outage')return send(503,{denied:true});
    if(session==='malformed')return send(200,{role:'ADMIN'});
    if(!['approved','restricted','revoked'].includes(session))return send(403,{denied:true});
    return send(200,{id:'fixture-admin',role:'ADMIN'});
  }
  if(path==='/health/ready'){counts.health++;return send(200,{status:'ok'});}
  if(path==='/admin/users'){
    counts.directory++;
    if(session!=='approved')return send(403,{denied:true});
    return send(200,{data:[{id:'00000000-0000-4000-8000-000000000001',email:'private-operator@example.test',role:'ATHLETE',status:'ACTIVE',createdAt:'2026-11-01T00:00:00.000Z'}],meta:{total:1,skip:0,take:20,totalPages:1}});
  }
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
      if ((await request('/sign-in')).status === 200) {
        ready = true;
        break;
      }
    } catch {
      /* startup */
    }
    await sleep(1000);
  }
  assert.ok(ready, 'Admin did not become ready');
  assert.notEqual(docker('exec', id, 'id', '-u'), '0');
  const login = await request('/sign-in', { headers: { 'accept-language': 'en' } });
  const html = await login.text();
  assert.match(html, /<html[^>]*lang="en"/);
  assert.match(html, /noindex/);
  const css = html.match(/href="(\/_next\/static\/[^"]+\.css[^"]*)"/)?.[1];
  assert.ok(css);
  assert.equal((await request(css.replaceAll('&amp;', '&'))).status, 200);
  const signIn = (email, sendOrigin = true) =>
    request('/backend/auth/admin-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(sendOrigin ? { origin } : {}) },
      body: JSON.stringify({ email }),
    });
  assert.equal((await signIn('fixture@example.test', false)).status, 403);
  const auth = await signIn('fixture@example.test');
  assert.equal(auth.status, 200);
  assert.equal((await auth.json()).mfaRequired, false);
  const cookies = auth.headers.getSetCookie();
  assert.equal(cookies.length, 1);
  assert.match(cookies[0], /^__Host-admin-sid=approved;/);
  assert.match(cookies[0], /HttpOnly/i);
  assert.match(cookies[0], /Secure/i);
  assert.match(cookies[0], /Path=\//i);
  assert.doesNotMatch(cookies[0], /Domain=/i);
  const cookie = cookies[0].split(';')[0];
  const pending = await signIn('mfa@example.test');
  assert.equal((await pending.json()).mfaRequired, true);
  const pendingCookie = pending.headers.getSetCookie()[0].split(';')[0];
  assert.equal(
    (await request('/backend/auth/admin-session', { headers: { cookie: pendingCookie } })).status,
    401,
  );
  const session = await request('/backend/auth/admin-session', { headers: { cookie } });
  assert.equal(session.status, 200);
  assert.equal((await session.json()).role, 'ADMIN');
  const page = async (path, cookie = '') => {
    const res = await request(path, { headers: { cookie, 'accept-language': 'en' } });
    assert.equal(res.status, 200);
    if (path === '/users' || path === '/notifications') {
      assert.match(res.headers.get('cache-control') ?? '', /no-store/);
      assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
      assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
    }
    return res.text();
  };
  const counts = async () => (await request('/backend/fixture-counts')).json();
  for (const [denied, message] of [
    ['', 'A separate administrator session is required.'],
    ['__Host-sid=ordinary', 'A separate administrator session is required.'],
    [pendingCookie, 'A separate administrator session is required.'],
    ['__Host-admin-sid=expired', 'A separate administrator session is required.'],
    ['__Host-admin-sid=athlete', 'You do not have administrator access.'],
    ['__Host-admin-sid=malformed', 'Unable to check permissions.'],
    ['__Host-admin-sid=outage', 'Unable to check permissions.'],
  ]) {
    for (const path of ['/', '/users', '/notifications']) {
      const body = await page(path, denied);
      assert.ok(body.includes(message), path + ': expected ' + message);
      assert.doesNotMatch(body, /private-operator@example.test|id="admin-readiness-heading"/);
    }
  }
  assert.deepEqual(await counts(), { directory: 0, health: 0 });
  assert.match(await page('/', cookie), /id="admin-readiness-heading"/);
  assert.match(await page('/users', cookie), /private-operator@example.test/);
  for (const token of ['restricted', 'revoked']) {
    const body = await page('/users', '__Host-admin-sid=' + token);
    assert.match(body, /Insufficient permissions/);
    assert.doesNotMatch(body, /private-operator@example.test/);
  }
  assert.doesNotMatch(await page('/users'), /private-operator@example.test/);
  const bad = docker('run', '-d', '-e', 'GYM_API_INTERNAL_URL=http://wrong:3000', image);
  ids.push(bad);
  assert.equal(docker('wait', bad), '1');
  const logs = spawnSync('docker', ['logs', bad], { encoding: 'utf8' });
  assert.equal(logs.status, 0);
  assert.match(logs.stdout + logs.stderr, /Invalid fixed API origin/);
  console.log(
    'Admin container smoke passed: session boundary, pending MFA denial, operator directory, no-store, noindex, fixed upstream.',
  );
} catch (error) {
  for (const id of ids) console.error(docker('logs', id));
  throw error;
} finally {
  for (const id of ids.reverse()) docker('rm', '-f', id);
  docker('network', 'rm', network);
}
