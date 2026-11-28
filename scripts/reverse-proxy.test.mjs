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

test('inactive staging edge and environment use disjoint hosts and loopback-only access', () => {
  const stagingConfig = read('infra/proxy/Caddyfile.staging');
  const stagingEnv = Object.fromEntries(
    read('infra/proxy/staging.env.example')
      .split('\n')
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => line.split('=')),
  );
  const hosts = {
    'staging.ovranto.com': 'LANDING_PORT',
    'app-staging.ovranto.com': 'WEB_PORT',
    'coach-staging.ovranto.com': 'TRAINER_PORT',
    'admin-staging.ovranto.com': 'ADMIN_PORT',
    'api-staging.ovranto.com': 'API_PORT',
  };
  const routes = [
    ...stagingConfig.matchAll(/^([a-z.-]+) \{\n\s+route \{\n\s+import upstream (\d+)\n\s+\}\n\}/gm),
  ];
  assert.equal(routes.length, 5);
  for (const [host, port] of Object.entries(hosts)) {
    assert.equal(routes.find((r) => r[1] === host)?.[2], stagingEnv[port]);
    assert.equal(stagingEnv[port], env[port]);
    assert.ok(stagingConfig.includes('http://' + host));
  }
  assert.equal(stagingEnv.APP_URL, 'https://app-staging.ovranto.com');
  assert.equal(stagingEnv.ADMIN_APP_URL, 'https://admin-staging.ovranto.com');
  assert.equal(stagingEnv.TRAINER_APP_URL, 'https://coach-staging.ovranto.com');
  assert.equal(stagingEnv.JWT_ISSUER, 'https://api-staging.ovranto.com');
  assert.deepEqual(
    stagingEnv.CORS_ORIGINS.split(',').sort(),
    [stagingEnv.APP_URL, stagingEnv.ADMIN_APP_URL, stagingEnv.TRAINER_APP_URL].sort(),
  );
  assert.ok(
    stagingEnv.CORS_ORIGINS.split(',').every(
      (origin) => !env.CORS_ORIGINS.split(',').includes(origin),
    ),
  );
  assert.equal(stagingEnv.SMTP_RECIPIENT_ALLOWLIST, 'fixture@example.test');
  assert.equal(stagingEnv.TRUSTED_PROXY_CIDRS, '');
  assert.equal(stagingEnv.NOTIFICATION_DISPATCH_ENABLED, 'false');
  assert.equal(stagingEnv.HTTP_METRICS_ENABLED, 'false');
  assert.match(stagingConfig, /local_certs/);
  assert.match(stagingConfig, /strict_sni_host on/);
  assert.equal(
    [...stagingConfig.matchAll(/@denied not remote_ip 127\.0\.0\.1\/32\n\s+respond @denied 403/g)]
      .length,
    2,
  );
  assert.doesNotMatch(stagingConfig, /trusted_proxies|on_demand|client_ip|\*\.ovranto\.com/);
  assert.match(
    read('.github/workflows/ci.yml'),
    /run: node scripts\/reverse-proxy-smoke\.mjs --staging/,
  );
});
