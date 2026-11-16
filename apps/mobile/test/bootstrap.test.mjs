import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'vitest';

const appConfig = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('expo router is configured as the entry point and plugin', () => {
  assert.equal(manifest.main, 'index.js');
  const entry = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  assert.equal(entry.trim(), "import 'expo-router/entry';");

  assert.ok(appConfig.expo.plugins.includes('expo-router'));
  assert.equal(appConfig.expo.scheme, 'gymplatform');
});

test('Expo Router has both application routes', () => {
  assert.ok(existsSync(new URL('../src/app/(tabs)/index.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../src/app/(tabs)/profile.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../src/app/(tabs)/workouts.tsx', import.meta.url)));
});

test('mobile CI build exports both web and native iOS JavaScript', () => {
  assert.match(manifest.scripts.build, /export-web\.mjs/);
  assert.match(manifest.scripts.build, /export-ios\.mjs/);
  assert.equal(manifest.scripts['build:ios'], 'node scripts/export-ios.mjs');
  const iosExport = readFileSync(new URL('../scripts/export-ios.mjs', import.meta.url), 'utf8');
  assert.match(iosExport, /'--platform',\s*'ios'/);
  assert.match(iosExport, /'--output-dir'/);
});
