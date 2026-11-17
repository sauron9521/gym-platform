import { expect, test } from 'vitest';

import { releaseErrors } from '../scripts/release-preflight.mjs';

test('production release requires a real HTTPS site and explicit index opt-in', () => {
  expect(releaseErrors({})).toHaveLength(2);
  expect(
    releaseErrors({
      LANDING_SITE_URL: 'http://localhost:3002',
      LANDING_ALLOW_INDEXING: 'true',
    }),
  ).toHaveLength(1);
  expect(
    releaseErrors({
      LANDING_SITE_URL: 'https://gym.example',
      LANDING_ALLOW_INDEXING: 'true',
    }),
  ).toHaveLength(1);
  expect(
    releaseErrors({
      LANDING_SITE_URL: 'https://gymplatform.com',
      LANDING_ALLOW_INDEXING: 'true',
    }),
  ).toHaveLength(0);
});

test('analytics configuration is all-or-nothing at release', () => {
  const issues = releaseErrors({
    LANDING_SITE_URL: 'https://gymplatform.com',
    LANDING_ALLOW_INDEXING: 'true',
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: '00000000-0000-0000-0000-000000000000',
  });
  expect(issues).toHaveLength(1);
  expect(issues[0]).toContain('analytics');
});
