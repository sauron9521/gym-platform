import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const image = process.argv[2] ?? 'gym-platform-landing:pilot';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const id = docker(
  'run',
  '-d',
  '--init',
  '--cap-drop=ALL',
  '--security-opt=no-new-privileges',
  '-p',
  '127.0.0.1::3000',
  image,
);
try {
  const origin = 'http://' + docker('port', id, '3000/tcp');
  const request = (path) =>
    fetch(origin + path, { signal: AbortSignal.timeout(5000), redirect: 'manual' });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await request('/uk')).status === 200) {
        ready = true;
        break;
      }
    } catch {
      /* startup */
    }
    await sleep(1000);
  }
  assert.ok(ready, 'Landing did not become ready');
  assert.notEqual(docker('exec', id, 'id', '-u'), '0');
  const uk = await request('/uk');
  assert.equal(uk.status, 200);
  assert.equal(uk.headers.get('x-content-type-options'), 'nosniff');
  const html = await uk.text();
  assert.match(html, /<html[^>]*lang="uk"/);
  assert.match(html, /noindex/);
  const en = await request('/en');
  assert.equal(en.status, 200);
  assert.match(await en.text(), /<html[^>]*lang="en"/);
  assert.equal((await request('/en/features')).status, 200);
  assert.equal((await request('/en/about')).status, 404);
  const css = html.match(/href="(\/_next\/static\/[^"]+\.css[^"]*)"/)?.[1];
  assert.ok(css, 'Expected a compiled stylesheet');
  assert.equal((await request(css.replaceAll('&amp;', '&'))).status, 200);
  const asset = await request('/product-previews/athlete-workouts.webp');
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type') ?? '', /image\/webp/);
  const robots = await request('/robots.txt');
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Disallow: \//);
  const sitemap = await request('/sitemap.xml');
  assert.equal(sitemap.status, 200);
  assert.doesNotMatch(await sitemap.text(), /<loc>/);
  console.log('Landing container smoke passed: locales, noindex, assets, headers, non-root.');
} catch (error) {
  console.error(docker('logs', id));
  throw error;
} finally {
  docker('rm', '-f', id);
}
