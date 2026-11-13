import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classifySessionCheck, getLoginErrorMessage } from '../src/features/auth/lib/auth-flow.ts';

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
