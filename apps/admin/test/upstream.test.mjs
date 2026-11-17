import assert from 'node:assert/strict';
import { test } from 'vitest';

import { getAdminApiOrigin } from '../src/shared/api/upstream.mjs';

test('admin rewrite accepts only a trusted, configured API origin', () => {
  assert.equal(getAdminApiOrigin('https://api.example.test/'), 'https://api.example.test');
  for (const value of [
    'https://user:pass@api.example.test',
    'https://api.example.test/path',
    'https://api.example.test/?token=unsafe',
    'file:///etc/passwd',
  ]) {
    assert.throws(() => getAdminApiOrigin(value));
  }
});
