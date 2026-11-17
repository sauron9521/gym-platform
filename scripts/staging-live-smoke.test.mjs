import assert from 'node:assert/strict';
import { test } from 'vitest';

import { checkStagingHealth, validateStagingOrigin } from './staging-live-smoke.mjs';

test('only explicit HTTPS staging origins can be checked', () => {
  assert.equal(
    validateStagingOrigin('https://staging.gym.example.com'),
    'https://staging.gym.example.com',
  );
  for (const invalid of [
    '',
    'http://staging.example.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://staging.internal',
    'https://production.example.com',
    'https://api.gym.example.com',
    'https://prod-staging.example.com',
    'https://staging.example.com/path',
    'https://user:pass@staging.example.com',
    'https://staging.example.com?x=1',
  ]) {
    assert.throws(() => validateStagingOrigin(invalid), invalid);
  }
});

test('staging checks require exact healthy JSON from both endpoints', async () => {
  const requested = [];
  const send = async (url, init) => {
    requested.push([url, init.method, init.redirect, init.credentials]);
    return { status: 200, json: async () => ({ status: 'ok' }) };
  };
  assert.equal(await checkStagingHealth('https://staging.gym.example.com', send), true);
  assert.deepEqual(requested, [
    ['https://staging.gym.example.com/health/live', 'GET', 'error', 'omit'],
    ['https://staging.gym.example.com/health/ready', 'GET', 'error', 'omit'],
  ]);
});

test('staging check never treats 503 or malformed health payloads as success', async () => {
  await assert.rejects(
    checkStagingHealth('https://staging.gym.example.com', async () => ({ status: 503 })),
    /503/,
  );
  await assert.rejects(
    checkStagingHealth('https://staging.gym.example.com', async () => ({
      status: 200,
      json: async () => ({ status: 'degraded' }),
    })),
    /invalid health response/,
  );
});

test('a production origin is rejected before making any network request', async () => {
  let requests = 0;
  await assert.rejects(
    checkStagingHealth('https://api.gym.example.com', async () => {
      requests += 1;
      return { status: 200, json: async () => ({ status: 'ok' }) };
    }),
    /staging subdomain/,
  );
  assert.equal(requests, 0);
});

test('redirects, invalid JSON and an unhealthy readiness response fail closed', async () => {
  await assert.rejects(
    checkStagingHealth('https://staging.gym.example.com', async () => ({
      status: 302,
    })),
    /302/,
  );
  await assert.rejects(
    checkStagingHealth('https://staging.gym.example.com', async () => ({
      status: 200,
      json: async () => {
        throw new SyntaxError('Invalid JSON');
      },
    })),
    /Invalid JSON/,
  );
  let requests = 0;
  await assert.rejects(
    checkStagingHealth('https://staging.gym.example.com', async () => {
      requests += 1;
      return { status: requests === 1 ? 200 : 503, json: async () => ({ status: 'ok' }) };
    }),
    /503/,
  );
  assert.equal(requests, 2);
});
