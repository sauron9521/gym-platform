import assert from 'node:assert/strict';
import { test } from 'vitest';

import { readAdminHealth } from '../src/shared/api/admin-health.ts';

const origin = 'http://127.0.0.1:3001';

test('accepts only a verified readiness response without caching it', async () => {
  let path;
  let options;
  const result = await readAdminHealth(origin, async (url, init) => {
    path = url;
    options = init;
    return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
  });
  assert.equal(result, 'healthy');
  assert.equal(path, origin + '/health/ready');
  assert.equal(options.cache, 'no-store');
  assert.equal(options.redirect, 'error');
});

test('degrades safely for unavailable or untrusted API responses', async () => {
  assert.equal(await readAdminHealth('https://user:secret@api.example.test'), 'degraded');
  assert.equal(
    await readAdminHealth(origin, async () => new Response('{}', { status: 503 })),
    'degraded',
  );
  assert.equal(
    await readAdminHealth(origin, async () => new Response('{}', { status: 200 })),
    'degraded',
  );
});
