import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import { validateMobileSmokeInputs } from '../../../scripts/validate-mobile-smoke-inputs.mjs';

const valid = {
  apkUrl: 'https://expo.dev/artifacts/eas/abcDEF-123.apk',
  apkSha256: 'a'.repeat(64),
  appId: 'com.example.gymplatform',
};

test('preview APK and Maestro tests are explicitly operator-driven', () => {
  const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
  const flow = readFileSync(
    new URL('../maestro/flows/session-restore-smoke.yaml', import.meta.url),
    'utf8',
  );
  const workflow = readFileSync(
    new URL('../../../.github/workflows/mobile-native-e2e.yml', import.meta.url),
    'utf8',
  );

  assert.equal(eas.build.preview.android.buildType, 'apk');
  assert.equal(eas.build.preview.environment, 'preview');
  assert.match(flow, /clearState: false/);
  assert.match(flow, /- stopApp/);
  assert.match(flow, /- tapOn: Вийти/);
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /mobile-staging/);
  assert.match(workflow, /reactivecircus\/android-emulator-runner@v2/);
  assert.match(workflow, /validate-mobile-smoke-inputs\.mjs/);
  assert.match(workflow, /sha256sum --check --status/);
  assert.match(workflow, /dump badging/);
  assert.match(workflow, /MAESTRO_VERSION: '2\.12\.1'/);
  assert.doesNotMatch(workflow, /on:\s*push/);
  assert.doesNotMatch(flow, /password123|@example\.com/);
});

test('APK URL and checksum accept only direct trusted Expo artifacts', () => {
  assert.deepEqual(validateMobileSmokeInputs(valid), {
    url: valid.apkUrl,
    sha256: valid.apkSha256,
    appId: valid.appId,
  });
  assert.equal(
    validateMobileSmokeInputs({ ...valid, apkSha256: 'A'.repeat(64) }).sha256,
    valid.apkSha256,
  );
  const invalidUrls = [
    'http://expo.dev/artifacts/eas/a.apk',
    'https://expo.dev.evil.example/artifacts/eas/a.apk',
    'https://example.com/a.apk',
    'https://expo.dev/artifacts/eas/a.aab',
    'https://expo.dev/artifacts/eas/a.apk?download=1',
    'https://expo.dev/artifacts/eas/a.apk#fragment',
    'https://user:pass@expo.dev/artifacts/eas/a.apk',
    'https://expo.dev:443/artifacts/eas/a.apk?token=abc',
    'https://expo.dev/other/a.apk',
  ];
  for (const apkUrl of invalidUrls) {
    assert.throws(() => validateMobileSmokeInputs({ ...valid, apkUrl }), /APK URL/);
  }
});

test('invalid digests and injected Android app IDs are rejected', () => {
  for (const apkSha256 of ['', 'a'.repeat(63), 'z'.repeat(64)]) {
    assert.throws(() => validateMobileSmokeInputs({ ...valid, apkSha256 }), /SHA-256/);
  }
  for (const appId of [
    'invalid',
    '../com.gym',
    'com.example.gym;echo injected',
    'com.example.gym app',
    'com..gym',
  ]) {
    assert.throws(() => validateMobileSmokeInputs({ ...valid, appId }), /application ID/);
  }
});
