import assert from 'node:assert/strict';
import { test } from 'node:test';

import config from '../next.config.ts';

test('browser API routes use a fixed same-origin rewrite to the backend', async () => {
  const result = await config.rewrites();
  assert.deepEqual(result, [
    { source: '/backend/:path*', destination: 'http://localhost:3001/:path*' },
  ]);
});
