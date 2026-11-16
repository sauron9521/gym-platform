import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { validateMobileApiBaseUrl } from '../src/shared/api/client.ts';

import {
  getMobileLoginError,
  validateMobileCredentials,
} from '../src/features/auth/lib/login-flow.ts';

test('credentials validation rejects malformed emails and whitespace passwords', () => {
  assert.match(validateMobileCredentials('invalid', 'abc'), /адресу/);
  assert.match(validateMobileCredentials('valid@example.test', '  '), /пароль/);
  assert.equal(validateMobileCredentials(' valid@example.test ', 'pass'), null);
});

test('auth errors distinguish invalid credentials from throttling', () => {
  assert.match(getMobileLoginError(401), /Невірна/);
  assert.match(getMobileLoginError(429), /Забагато/);
  assert.match(getMobileLoginError(500), /Не вдалося/);
});

test('native token flow guards protected routes and avoids plaintext storage', () => {
  const layout = readFileSync(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8');
  const auth = readFileSync(
    new URL('../src/features/auth/model/auth-context.tsx', import.meta.url),
    'utf8',
  );
  assert.match(layout, /Stack\.Protected/);
  assert.match(layout, /guard=\{Boolean\(account\)\}/);
  assert.match(auth, /guestApi\.POST\('\/auth\/token'/);
  assert.match(auth, /api\.POST\('\/auth\/token\/revoke'/);
  assert.match(auth, /api\.GET\('\/users\/me'/);
  assert.doesNotMatch(auth, /AsyncStorage|localStorage|console\.log/);
});

test('native release rejects HTTP token transport but development permits LAN API', () => {
  assert.equal(
    validateMobileApiBaseUrl('http://192.168.1.20:3001', false),
    'http://192.168.1.20:3001',
  );
  assert.equal(
    validateMobileApiBaseUrl('https://api.example.test', true),
    'https://api.example.test',
  );
  assert.throws(
    () => validateMobileApiBaseUrl('http://192.168.1.20:3001', true),
    /require HTTPS/,
  );
  assert.throws(
    () => validateMobileApiBaseUrl('http://user:secret@host.test', false),
    /without credentials/,
  );
});
