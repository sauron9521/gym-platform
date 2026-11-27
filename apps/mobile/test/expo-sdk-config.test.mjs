import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;

test('Expo SDK 58 config does not use the removed Android edge-to-edge switch', () => {
  // SDK 55+ enforces edge-to-edge on supported Android targets.
  // Reintroducing android.edgeToEdgeEnabled fails Expo Doctor schema validation.
  assert.equal(Object.hasOwn(app.android ?? {}, 'edgeToEdgeEnabled'), false);
});

test('Expo SDK 58 rejects removed new-architecture switch and preserves native and web contracts', () => {
  assert.equal(Object.hasOwn(app, 'newArchEnabled'), false);
  assert.equal(app.ios.supportsTablet, true);
  assert.equal(app.web.bundler, 'metro');
  assert.equal(app.web.output, 'static');
  assert.deepEqual(app.plugins, [
    'expo-router',
    'expo-secure-store',
    'expo-localization',
    ['expo-sqlite', { useSQLCipher: true }],
    [
      'expo-audio',
      {
        microphonePermission: false,
        recordAudioAndroid: false,
        enableBackgroundRecording: false,
        enableBackgroundPlayback: false,
      },
    ],
    [
      'expo-notifications',
      { enableRemoteNotifications: false, enableBackgroundRemoteNotifications: false },
    ],
  ]);
  assert.equal(app.experiments.typedRoutes, true);
});
