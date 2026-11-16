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
    requested.push([url, init.method, init.redirect]);
    return { status: 200, json: async () => ({ status: 'ok' }) };
  };
  assert.equal(await checkStagingHealth('https://staging.gym.example.com', send), true);
  assert.deepEqual(requested, [
    ['https://staging.gym.example.com/health/live', 'GET', 'error'],
    ['https://staging.gym.example.com/health/ready', 'GET', 'error'],
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
