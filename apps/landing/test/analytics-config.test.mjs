import { expect, test } from 'vitest';

import { getAnalyticsScriptConfig } from '../src/shared/lib/analytics-config.ts';

const websiteId = '15a01234-1234-1234-1234-abcde1234567';
const validUrl = 'https://cloud.umami.is/script.js';

test('analytics is disabled without both valid operator settings', () => {
  expect(getAnalyticsScriptConfig(undefined, validUrl)).toBeNull();
  expect(getAnalyticsScriptConfig(websiteId, undefined)).toBeNull();
  expect(getAnalyticsScriptConfig('not-a-uuid', validUrl)).toBeNull();
  expect(getAnalyticsScriptConfig(websiteId, validUrl)).toEqual({
    websiteId,
    src: validUrl,
  });
});

test('analytics rejects unsafe script URLs and parameters', () => {
  for (const url of [
    'http://cloud.umami.is/script.js',
    'javascript:alert(1)',
    'https://user:secret@cloud.umami.is/script.js',
    'https://cloud.umami.is/script.js?token=abc',
    'https://cloud.umami.is/script.js#fragment',
    'https://cloud.umami.is/collect',
  ]) {
    expect(getAnalyticsScriptConfig(websiteId, url)).toBeNull();
  }
});
