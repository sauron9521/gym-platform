import assert from 'node:assert/strict';
import { test } from 'vitest';

import { getAdminApiOrigin } from '../src/shared/api/upstream.mjs';

test('admin rewrite resolves only a trusted HTTP(S) origin', () => {
  assert.equal(getAdminApiOrigin('https://api.example.test/'), 'https://api.example.test');
  assert.equal(getAdminApiOrigin('http://localhost:3001'), 'http://localhost:3001');
  for (const unsafe of [
    'https://user:pass@api.example.test',
    'https://api.example.test/path',
    'https://api.example.test/?token=unsafe',
    'file:///etc/passwd',
    'ftp://api.example.test',
    'not-a-url',
  ]) {
    assert.throws(() => getAdminApiOrigin(unsafe));
  }
});
