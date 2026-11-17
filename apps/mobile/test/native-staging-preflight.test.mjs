import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import { validateNativeStagingConfig } from '../scripts/native-staging-preflight.mjs';

const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const configured = {
  expo: {
    ...app.expo,
    android: { ...app.expo.android, package: 'app.gymplatform.preview' },
    ios: { ...app.expo.ios, bundleIdentifier: 'app.gymplatform.preview' },
  },
};

test('staging config refuses builds without reviewed platform identifiers', () => {
  const failures = validateNativeStagingConfig(app, eas);
  assert.ok(failures.some((x) => x.includes('android.package')));
  assert.ok(failures.some((x) => x.includes('ios.bundleIdentifier')));
});

test('staging config accepts app identities with isolated preview builds', () => {
  assert.deepEqual(validateNativeStagingConfig(configured, eas), []);
});

test('staging config rejects unsafe artifact profiles and malformed IDs', () => {
  const unsafe = structuredClone(eas);
  unsafe.build.preview.distribution = 'store';
  unsafe.build.preview.environment = 'production';
  unsafe.build.preview.android.buildType = 'app-bundle';
  const findings = validateNativeStagingConfig(configured, unsafe);
  assert.equal(findings.length, 3);
  assert.ok(
    validateNativeStagingConfig(
      { expo: { ...configured.expo, android: { package: 'not.valid!' } } },
      eas,
    ).some((message) => message.includes('android.package')),
  );
});
