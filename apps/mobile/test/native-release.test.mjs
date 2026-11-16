import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const profiles = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
const smoke = readFileSync(new URL('../maestro/flows/auth-smoke.yaml', import.meta.url), 'utf8');
const signIn = readFileSync(
  new URL('../src/screens/sign-in/ui/sign-in-screen.tsx', import.meta.url),
  'utf8',
);

test('native release profiles separate internal preview and production builds', () => {
  assert.equal(profiles.build.preview.distribution, 'internal');
  assert.equal(profiles.build.production.autoIncrement, true);
  assert.ok(profiles.submit.production);
  assert.equal(profiles.cli.appVersionSource, 'remote');
});

test('native smoke requires disposable account and stable native input selectors', () => {
  assert.match(smoke, /appId: \$\{APP_ID\}/);
  assert.match(smoke, /\$\{E2E_EMAIL\}/);
  assert.match(smoke, /\$\{E2E_PASSWORD\}/);
  assert.match(smoke, /clearState: true/);
  assert.match(smoke, /id: sign-in-email/);
  assert.match(smoke, /id: sign-in-password/);
  assert.match(smoke, /Оновити профіль/);
  assert.match(smoke, /Вийти/);
  assert.match(signIn, /testID="sign-in-email"/);
  assert.match(signIn, /testID="sign-in-password"/);
  assert.doesNotMatch(smoke, /@example\.com|password123|localhost/);
});
