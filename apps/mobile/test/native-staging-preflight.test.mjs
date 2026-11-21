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

test('production versioning requires remote EAS source and auto increment', () => {
  const localVersioning = structuredClone(eas);
  localVersioning.cli.appVersionSource = 'local';
  localVersioning.build.production.autoIncrement = false;

  const findings = validateNativeStagingConfig(configured, localVersioning);
  assert.ok(findings.some((message) => message.includes('appVersionSource')));
  assert.ok(findings.some((message) => message.includes('Production build version')));
});

test('Android-only preflight never requires unrelated iOS bundle ID', () => {
  const androidOnly = {
    expo: { ...app.expo, android: { package: 'app.gymplatform.preview' } },
  };
  assert.deepEqual(validateNativeStagingConfig(androidOnly, eas, { platform: 'android' }), []);
  assert.ok(
    validateNativeStagingConfig(androidOnly, eas).some((x) => x.includes('ios.bundleIdentifier')),
  );
  assert.ok(
    validateNativeStagingConfig(app, eas, { platform: 'android' }).some((x) =>
      x.includes('android.package'),
    ),
  );
});

test('iOS-only preflight ignores Android package and APK-only restriction', () => {
  const iosOnly = {
    expo: { ...app.expo, ios: { bundleIdentifier: 'app.gymplatform.preview' } },
  };
  const preview = structuredClone(eas);
  preview.build.preview.android.buildType = 'app-bundle';
  assert.deepEqual(validateNativeStagingConfig(iosOnly, preview, { platform: 'ios' }), []);
  assert.ok(
    validateNativeStagingConfig(iosOnly, preview, { platform: 'android' }).some((x) =>
      x.includes('Android preview requires an APK'),
    ),
  );
});

test('preflight rejects unsupported platform values rather than silently weakening checks', () => {
  for (const platform of ['Android', 'alll', '', 'web']) {
    assert.deepEqual(validateNativeStagingConfig(configured, eas, { platform }), [
      'Invalid --platform. Choose android, ios, or all.',
    ]);
  }
});
