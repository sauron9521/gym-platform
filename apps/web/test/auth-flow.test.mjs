import assert from 'node:assert/strict';
import { test } from 'vitest';

import { classifySessionCheck, getLoginErrorKey, getLoginErrorMessage } from '../src/features/auth/lib/auth-flow.ts';

test('login errors keep invalid credentials distinct from CSRF and rate limiting', () => {
  assert.match(getLoginErrorMessage(401), /Невірна/);
  assert.match(getLoginErrorMessage(403), /безпеки/);
  assert.match(getLoginErrorMessage(429), /Забагато/);
  assert.notEqual(getLoginErrorMessage(401), getLoginErrorMessage(403));
});

test('session guard never grants access without a verified profile', () => {
  assert.equal(classifySessionCheck(200, true), 'authenticated');
  assert.equal(classifySessionCheck(200, false), 'error');
  assert.equal(classifySessionCheck(401, false), 'unauthenticated');
  assert.equal(classifySessionCheck(403, false), 'forbidden');
  assert.equal(classifySessionCheck(500, false), 'error');
});

test('safe HTTP status maps to locale-independent translation keys', () => {
  assert.equal(getLoginErrorKey(401), 'invalidCredentials');
  assert.equal(getLoginErrorKey(403), 'security');
  assert.equal(getLoginErrorKey(429), 'rateLimited');
  assert.equal(getLoginErrorKey(503), 'unknown');
});
