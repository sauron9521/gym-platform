import { expect, test } from 'vitest';

import { releaseErrors } from '../scripts/release-preflight.mjs';

const validEnv = {
  LANDING_SITE_URL: 'https://gymplatform.com',
};

test('release configuration needs a public HTTPS origin, but not forced indexing', () => {
  expect(releaseErrors({})).toHaveLength(1);
  expect(releaseErrors(validEnv)).toEqual([]);
  expect(releaseErrors({ ...validEnv, LANDING_ALLOW_INDEXING: 'false' })).toEqual([]);
  expect(releaseErrors({ ...validEnv, LANDING_ALLOW_INDEXING: 'true' })).toEqual([]);
  expect(releaseErrors({ ...validEnv, LANDING_ALLOW_INDEXING: 'yes' })).toHaveLength(1);
});

test('reserved, local and malformed release origins fail closed', () => {
  for (const url of [
    'http://localhost:3002',
    'https://gym.example',
    'https://gym.example.test',
    'https://localhost',
    'https://127.0.0.1',
    'https://[::1]',
    'https://gymplatform.com:8443',
    'https://gymplatform.com/subpath',
    'https://user:pass@gymplatform.com',
    'https://gymplatform.com?query=yes',
    'javascript:alert(1)',
  ]) {
    expect(releaseErrors({ LANDING_SITE_URL: url }).length).toBeGreaterThan(0);
  }
});

test('analytics settings are optional but must match client validation', () => {
  const id = '15a01234-1234-1234-1234-abcde1234567';
  const script = 'https://cloud.umami.is/script.js';
  expect(releaseErrors({ ...validEnv, NEXT_PUBLIC_UMAMI_WEBSITE_ID: id })).toHaveLength(1);
  expect(releaseErrors({ ...validEnv, NEXT_PUBLIC_UMAMI_SCRIPT_URL: script })).toHaveLength(1);
  expect(
    releaseErrors({
      ...validEnv,
      NEXT_PUBLIC_UMAMI_WEBSITE_ID: id,
      NEXT_PUBLIC_UMAMI_SCRIPT_URL: script,
    }),
  ).toEqual([]);
  for (const bad of [
    { NEXT_PUBLIC_UMAMI_WEBSITE_ID: 'not-a-uuid', NEXT_PUBLIC_UMAMI_SCRIPT_URL: script },
    { NEXT_PUBLIC_UMAMI_WEBSITE_ID: id, NEXT_PUBLIC_UMAMI_SCRIPT_URL: 'http://cloud.umami.is/script.js' },
    { NEXT_PUBLIC_UMAMI_WEBSITE_ID: id, NEXT_PUBLIC_UMAMI_SCRIPT_URL: 'https://cloud.umami.is/script.js?token=abc' },
  ]) {
    expect(releaseErrors({ ...validEnv, ...bad }).length).toBeGreaterThan(0);
  }
});
