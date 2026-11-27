import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const image = process.argv[2] ?? 'gym-platform-web:pilot';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const network = 'gym-web-smoke-' + randomUUID();
const ids = [];
// Synthetic protocol fixture, not a substitute for real NestJS security tests.
const fixture = String.raw`
const http = require('node:http');
http.createServer((req,res)=>{
  const send=(status,body,headers={})=>{
    res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...headers});
    res.end(JSON.stringify(body));
  };
  if(req.url==='/auth/login'&&req.method==='POST'){
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',()=>{
      if(!req.headers.origin || JSON.parse(body).email!=='fixture@example.test')
        return send(403,{denied:true});
      send(200,{ok:true},{'set-cookie':['pilot_session=fixture; Path=/; HttpOnly; SameSite=Lax; Secure','pilot_second=fixture; Path=/; HttpOnly; Secure']});
    });
    return;
  }
  if(req.url==='/users/me'){
    if(!(req.headers.cookie||'').includes('pilot_session=fixture'))return send(401,{denied:true});
    return send(200,{id:'fixture-user',email:'fixture@example.test',role:'ATHLETE',profile:{displayName:'Pilot Fixture Athlete'}});
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
      if ((await request('/login')).status === 200) {
        ready = true;
        break;
      }
    } catch {
      /* startup */
    }
    await sleep(1000);
  }
  assert.ok(ready, 'Web did not become ready');
  assert.notEqual(docker('exec', id, 'id', '-u'), '0');
  const login = await request('/login', { headers: { 'accept-language': 'en' } });
  const html = await login.text();
  assert.match(html, /<html[^>]*lang="en"/);
  const css = html.match(/href="(\/_next\/static\/[^"]+\.css[^"]*)"/)?.[1];
  assert.ok(css);
  assert.equal((await request(css.replaceAll('&amp;', '&'))).status, 200);
  assert.equal((await request('/backend/users/me')).status, 401);
  const anon = await request('/dashboard');
  assert.equal(anon.status, 307);
  assert.equal(anon.headers.get('location'), '/login');
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
  const me = await request('/backend/users/me', { headers: { cookie } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).id, 'fixture-user');
  assert.match(me.headers.get('cache-control') ?? '', /no-store/);
  const page = await request('/dashboard', { headers: { cookie } });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Pilot Fixture Athlete/);
  assert.equal((await request('/dashboard')).status, 307);
  // The fixed compiled rewrite and runtime SSR cannot diverge.
  const bad = docker('run', '-d', '-e', 'GYM_API_INTERNAL_URL=http://wrong:3000', image);
  ids.push(bad);
  assert.equal(docker('wait', bad), '1');
  const logs = spawnSync('docker', ['logs', bad], { encoding: 'utf8' });
  assert.equal(logs.status, 0);
  assert.match(logs.stdout + logs.stderr, /Invalid fixed API origin/);
  console.log(
    'Athlete Web container smoke passed: SSR, rewrite, cookies, origin forwarding, assets and fixed upstream.',
  );
} catch (error) {
  for (const id of ids) console.error(docker('logs', id));
  throw error;
} finally {
  for (const id of ids.reverse()) docker('rm', '-f', id);
  docker('network', 'rm', network);
}
