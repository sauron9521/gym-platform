import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { classifyChangedPaths } from './ci-select.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const config = read('infra/proxy/Caddyfile');
const env = Object.fromEntries(
  read('infra/proxy/production.env.example')
    .split('\n')
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => line.split('=')),
);

test('edge routes match the fixed pilot loopback ports and exact origin contract', () => {
  const hosts = {
    'ovranto.com': 'LANDING_PORT',
    'app.ovranto.com': 'WEB_PORT',
    'coach.ovranto.com': 'TRAINER_PORT',
    'admin.ovranto.com': 'ADMIN_PORT',
    'api.ovranto.com': 'API_PORT',
  };
  const routes = [...config.matchAll(/^([a-z.]+) \{\n\s+import upstream (\d+)\n\}/gm)];
  assert.equal(routes.length, 5);
  for (const [host, port] of Object.entries(hosts)) {
    assert.equal(routes.find((r) => r[1] === host)?.[2], env[port]);
    assert.ok(config.includes('http://' + host));
  }
  assert.equal(env.APP_URL, 'https://app.ovranto.com');
  assert.equal(env.ADMIN_APP_URL, 'https://admin.ovranto.com');
  assert.equal(env.TRAINER_APP_URL, 'https://coach.ovranto.com');
  assert.equal(env.JWT_ISSUER, 'https://api.ovranto.com');
  assert.deepEqual(
    env.CORS_ORIGINS.split(',').sort(),
    [env.APP_URL, env.ADMIN_APP_URL, env.TRAINER_APP_URL].sort(),
  );
  assert.equal(env.TRUSTED_PROXY_CIDRS, '');
  assert.equal(env.NOTIFICATION_DISPATCH_ENABLED, 'false');
  assert.equal(env.HTTP_METRICS_ENABLED, 'false');
  assert.match(config, /strict_sni_host on/);
  assert.match(config, /admin off/);
  assert.match(config, /respond @private 404/);
  assert.match(config, /respond 421/);
  assert.doesNotMatch(config, /trusted_proxies|on_demand|tls internal|\*\.ovranto\.com/);
});

test('edge smoke is required by full-scope API Docker CI and runs without public ports', () => {
  assert.equal(classifyChangedPaths(['infra/proxy/Caddyfile']).full, true);
  assert.equal(classifyChangedPaths(['scripts/reverse-proxy-smoke.mjs']).api, true);
  const workflow = read('.github/workflows/ci.yml');
  assert.match(
    workflow,
    /if: needs\.changes\.outputs\.full == 'true'\n\s+run: node scripts\/reverse-proxy-smoke\.mjs/,
  );
  const smoke = read('scripts/reverse-proxy-smoke.mjs');
  assert.match(smoke, /caddy:2-alpine@sha256:[a-f0-9]{64}/);
  assert.match(smoke, /'--network',\s*'none'/);
  assert.match(smoke, /'container:' \+ backend/);
  assert.doesNotMatch(smoke, /'--publish'|'--privileged'|'--network',\s*'host'/);
  assert.match(smoke, /local_certs/);
  assert.match(smoke, /assert\.rejects\(request\('unapproved\.invalid'\)\)/);
});
