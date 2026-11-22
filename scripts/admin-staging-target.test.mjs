import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'vitest';

import { validateAdminStagingTarget } from './admin-staging-target.mjs';

const approved = {
  origin: 'https://admin.staging.example.com',
  allowedHost: 'admin.staging.example.com',
  productionOrigin: 'https://admin.example.com',
  scope: 'quick',
  accountScope: 'DEDICATED_STAGING_ONLY',
};

test('manual Admin staging smoke accepts an exact HTTPS staging allowlist', () => {
  assert.deepEqual(validateAdminStagingTarget(approved), {
    origin: approved.origin,
    scope: 'quick',
  });
  for (const scope of ['idle-expiry', 'revoke-all']) {
    assert.equal(validateAdminStagingTarget({ ...approved, scope }).scope, scope);
  }
});

test('Admin staging guard fails closed before credentials can be used', () => {
  const cases = [
    { origin: 'https://admin.example.com' },
    { origin: 'https://admin.prod-staging.example.com' },
    { origin: 'http://admin.staging.example.com' },
    { origin: 'https://admin.staging.example.com:443' },
    { origin: 'https://admin.staging.example.com/redirect' },
    { origin: 'https://admin.staging.example.com?x=1' },
    { origin: 'https://username:password@admin.staging.example.com' },
    { origin: 'https://admin.staging.example.com.evil.org' },
    { origin: 'https://127.0.0.1' },
    { origin: '' },
    { allowedHost: 'admin.example.com' },
    { allowedHost: '' },
    { allowedHost: 'evil.example.com' },
    { productionOrigin: approved.origin },
    { productionOrigin: 'http://admin.example.com' },
    { productionOrigin: 'https://admin.example.com/path' },
    { productionOrigin: '' },
    { scope: 'destructive' },
    { scope: '' },
    { accountScope: '' },
    { accountScope: 'PRODUCTION_ACCOUNT' },
  ];
  for (const variant of cases) {
    assert.throws(
      () => validateAdminStagingTarget({ ...approved, ...variant }),
      undefined,
      JSON.stringify(variant),
    );
  }
});

test('staging workflow is manual, main-gated, protected and requires destructive confirmation', () => {
  const yaml = readFileSync(
    new URL('../.github/workflows/admin-staging-session-smoke.yml', import.meta.url),
    'utf8',
  );
  assert.match(yaml, /workflow_dispatch:/);
  assert.doesNotMatch(yaml, /^\s+(?:push|pull_request|schedule):/m);
  assert.match(yaml, /github\.ref == 'refs\/heads\/main'/);
  assert.match(yaml, /RUN_DEDICATED_STAGING/);
  assert.match(yaml, /I_APPROVE_STAGING_REVOKE/);
  assert.match(yaml, /environment: admin-staging/);
  assert.match(yaml, /secrets\.ADMIN_STAGING_PASSWORD/);
  assert.match(yaml, /test:e2e:staging/);
  assert.doesNotMatch(yaml, /actions\/upload-artifact/);
});
