import assert from 'node:assert/strict';
import { test } from 'vitest';

import { checkAdminStagingPreflight } from './admin-staging-preflight.mjs';

const settings = {
  origin: 'https://admin.staging.example.com',
  allowedHost: 'admin.staging.example.com',
  productionOrigin: 'https://admin.example.com',
  scope: 'preflight-only',
  accountScope: 'DEDICATED_STAGING_ONLY',
};
const expected = [
  ['/sign-in', 200, 'text/html'],
  ['/backend/health/live', 200, 'application/json'],
  ['/backend/health/ready', 200, 'application/json'],
  ['/backend/auth/admin-session', 401, 'application/json'],
];

function reply(path, overrides = {}) {
  const match = expected.find(([name]) => name === path);
  if (!match) throw new Error('Unexpected probe path');
  return {
    status: match[1],
    url: settings.origin + path,
    headers: { get: () => match[2] + '; charset=utf-8' },
    json: async () => ({ status: 'ok' }),
    ...overrides,
  };
}

test('read-only anonymous preflight probes sign-in, Nest liveness/readiness and unauthenticated session in order', async () => {
  const calls = [];
  const send = async (url, init) => {
    const path = new URL(url).pathname;
    calls.push({
      path,
      method: init.method,
      redirect: init.redirect,
      credentials: init.credentials,
      cache: init.cache,
      headers: init.headers,
    });
    return reply(path);
  };
  assert.equal(await checkAdminStagingPreflight(settings, send), true);
  assert.deepEqual(
    calls.map((call) => call.path),
    expected.map(([path]) => path),
  );
  assert.equal(
    calls.every(
      (c) =>
        c.method === 'GET' &&
        c.redirect === 'error' &&
        c.credentials === 'omit' &&
        c.cache === 'no-store',
    ),
    true,
  );
  assert.equal(
    calls.every((c) => Object.keys(c.headers).length === 1 && !('cookie' in c.headers)),
    true,
  );
});

test('target validation rejects production/mismatched host BEFORE even a public request', async () => {
  let calls = 0;
  await assert.rejects(
    checkAdminStagingPreflight({ ...settings, allowedHost: 'admin.example.com' }, async () => {
      calls++;
      return reply('/sign-in');
    }),
    /allowlist/,
  );
  assert.equal(calls, 0);
});

test('HTTP failure, captive landing page, redirects, unhealthy or authenticated anon session fail closed', async () => {
  const cases = [
    { path: '/sign-in', patch: { status: 302 }, message: /HTTP 302/ },
    { path: '/sign-in', patch: { url: 'https://admin.example.com/sign-in' }, message: /outside/ },
    { path: '/sign-in', patch: { headers: { get: () => 'application/json' } }, message: /HTML/ },
    { path: '/backend/health/live', patch: { status: 503 }, message: /HTTP 503/ },
    {
      path: '/backend/health/ready',
      patch: { json: async () => ({ status: 'degraded' }) },
      message: /unhealthy/,
    },
    { path: '/backend/auth/admin-session', patch: { status: 200 }, message: /expected 401/ },
  ];
  for (const { path, patch, message } of cases) {
    const calls = [];
    await assert.rejects(
      checkAdminStagingPreflight(settings, async (url) => {
        const current = new URL(url).pathname;
        calls.push(current);
        return reply(current, current === path ? patch : {});
      }),
      message,
    );
    assert.equal(calls.at(-1), path);
    assert.equal(
      calls.some(
        (value) =>
          expected.findIndex(([p]) => p === value) > expected.findIndex(([p]) => p === path),
      ),
      false,
    );
  }
});
