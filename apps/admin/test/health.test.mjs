import assert from 'node:assert/strict';
import { test } from 'vitest';

import { readAdminHealth } from '../src/shared/api/admin-health.ts';

const origin = 'http://127.0.0.1:3001';

test('checks the actual NestJS readiness route without credentials or caching', async () => {
  let requestedUrl;
  let options;
  const status = await readAdminHealth(origin, async (url, init) => {
    requestedUrl = url;
    options = init;
    return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
  });

  assert.equal(status, 'healthy');
  assert.equal(requestedUrl, origin + '/health/ready');
  assert.equal(options.cache, 'no-store');
  assert.equal(options.redirect, 'error');
  assert.equal(options.headers.accept, 'application/json');
  assert.equal(options.headers.cookie, undefined);
  assert.equal(options.signal instanceof AbortSignal, true);
});

test('fails safely for malformed or missing private upstream configuration', async () => {
  for (const config of [
    '',
    ' ',
    'https://user:secret@api.example.test',
    'https://api.example.test/unsafe',
    'https://api.example.test/?secret=unsafe',
    'ftp://api.example.test',
    'not-an-origin',
  ]) {
    assert.equal(await readAdminHealth(config, async () => {
      throw new Error('An invalid origin must not be fetched');
    }), 'degraded');
  }
});

test('degrades on upstream failure, redirects, invalid JSON and unexpected status', async () => {
  for (const response of [
    new Response(JSON.stringify({ status: 'ok' }), { status: 503 }),
    new Response(JSON.stringify({ status: 'ok' }), { status: 302 }),
    new Response(JSON.stringify({ status: 'error' }), { status: 200 }),
    new Response(JSON.stringify({ state: 'ok' }), { status: 200 }),
    new Response('{}', { status: 200 }),
    new Response('not-json', { status: 200 }),
    new Response(JSON.stringify(['ok']), { status: 200 }),
  ]) {
    assert.equal(await readAdminHealth(origin, async () => response), 'degraded');
  }
  assert.equal(
    await readAdminHealth(origin, async () => {
      throw new Error('Secret infrastructure failure');
    }),
    'degraded',
  );
});
