import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';

const appConfig = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('expo router is configured as the entry point and plugin', () => {
  assert.equal(manifest.main, 'expo-router/entry');
  assert.ok(appConfig.expo.plugins.includes('expo-router'));
  assert.equal(appConfig.expo.scheme, 'gymplatform');
});

test('Expo Router has both application routes', () => {
  assert.ok(existsSync(new URL('../src/app/(tabs)/index.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../src/app/(tabs)/profile.tsx', import.meta.url)));
});
