import assert from 'node:assert/strict';
import { test } from 'node:test';

import config from '../next.config.ts';
import { getApiUpstreamOrigin } from '../src/shared/api/upstream.mjs';

test('browser API routes use a fixed same-origin rewrite to the backend', async () => {
  const result = await config.rewrites();
  assert.deepEqual(result, [
    { source: '/backend/:path*', destination: 'http://localhost:3001/:path*' },
  ]);
});

test('production API origin must be explicit and trusted', () => {
  assert.throws(
    () => getApiUpstreamOrigin(undefined, { requireConfigured: true }),
    /GYM_API_INTERNAL_URL must be explicitly configured/,
  );
  assert.throws(
    () => getApiUpstreamOrigin(' ', { requireConfigured: true }),
    /GYM_API_INTERNAL_URL must be explicitly configured/,
  );
  assert.equal(
    getApiUpstreamOrigin('https://api.example.test', { requireConfigured: true }),
    'https://api.example.test',
  );
  assert.throws(
    () => getApiUpstreamOrigin('https://user:password@api.example.test'),
    /GYM_API_INTERNAL_URL must be an HTTP\(S\) origin/,
  );
});
