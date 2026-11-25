import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  getMobileLoginError,
  getMobileLoginTransportError,
  validateMobileCredentials,
} from '../src/features/auth/lib/login-flow.ts';

test('credentials validation rejects malformed emails and whitespace passwords', () => {
  assert.equal(validateMobileCredentials('invalid', 'abc'), 'invalidEmail');
  assert.equal(validateMobileCredentials('valid@example.test', '  '), 'invalidPassword');
  assert.equal(validateMobileCredentials(' valid@example.test ', 'pass'), null);
});

test('auth errors distinguish invalid credentials from throttling', () => {
  assert.equal(getMobileLoginError(400), 'invalidRequest');
  assert.equal(getMobileLoginError(403), 'accessDenied');
  assert.equal(getMobileLoginError(401), 'invalidCredentials');
  assert.equal(getMobileLoginError(429), 'throttled');
  assert.equal(getMobileLoginError(500), 'failed');
});

test('native token flow guards protected routes and avoids plaintext storage', () => {
  const layout = readFileSync(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8');
  const auth = readFileSync(
    new URL('../src/features/auth/model/auth-context.tsx', import.meta.url),
    'utf8',
  );
  assert.match(layout, /Stack\.Protected/);
  assert.match(layout, /guard=\{Boolean\(account && hasMobileAccess\(capabilities\)\)\}/);
  assert.match(auth, /guestApi\.POST\('\/auth\/token'/);
  assert.match(auth, /api\.POST\('\/auth\/token\/revoke'/);
  assert.match(auth, /api\.GET\('\/users\/me'/);
  assert.doesNotMatch(auth, /AsyncStorage|localStorage|console\.log/);
});

test('sign-in failures report the safe failed step, without exposing underlying errors', () => {
  assert.equal(getMobileLoginTransportError('issue'), 'connectionFailed');
  assert.equal(getMobileLoginTransportError('persist'), 'storageFailed');
  assert.equal(getMobileLoginTransportError('verify'), 'verificationFailed');
  assert.ok(!getMobileLoginTransportError('issue').includes('token'));
});
