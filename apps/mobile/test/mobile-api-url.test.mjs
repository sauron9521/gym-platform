import assert from 'node:assert/strict';
import { test } from 'vitest';

import { validateMobileApiBaseUrl } from '../src/shared/api/validate-mobile-api-url.ts';

test('release clients enforce HTTPS without blocking development LAN APIs', () => {
  assert.equal(
    validateMobileApiBaseUrl('http://192.168.1.20:3001', false),
    'http://192.168.1.20:3001',
  );
  assert.equal(
    validateMobileApiBaseUrl('https://api.example.test', true),
    'https://api.example.test',
  );
  assert.throws(() => validateMobileApiBaseUrl('http://192.168.1.20:3001', true), /require HTTPS/);
  assert.throws(
    () => validateMobileApiBaseUrl('http://user:secret@host.test', false),
    /without credentials/,
  );
});
