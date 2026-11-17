import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';
import { validateMobileReleaseChannels } from '../scripts/release-channel-preflight.mjs';
const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));

test('checked-in EAS profiles isolate preview and production channels', () => {
  expect(validateMobileReleaseChannels(eas)).toEqual([]);
});
test('unsafe release profile crossover fails closed', () => {
  const wrong = structuredClone(eas);
  wrong.build.preview.channel = 'production';
  wrong.build.production.environment = 'preview';
  expect(validateMobileReleaseChannels(wrong).length).toBeGreaterThan(0);
});
