import { defineConfig, devices } from '@playwright/test';

import { validateAdminStagingTarget } from '../../scripts/admin-staging-target.mjs';

const target = validateAdminStagingTarget({
  origin: process.env.ADMIN_STAGING_ORIGIN,
  allowedHost: process.env.ADMIN_STAGING_ALLOWED_HOST,
  productionOrigin: process.env.ADMIN_PRODUCTION_ORIGIN,
  scope: process.env.ADMIN_STAGING_SCOPE,
  accountScope: process.env.ADMIN_STAGING_ACCOUNT_SCOPE,
});

if (!process.env.ADMIN_STAGING_EMAIL || !process.env.ADMIN_STAGING_PASSWORD) {
  throw new Error('Dedicated Admin staging credentials are missing');
}

export default defineConfig({
  testDir: './e2e/staging',
  workers: 1,
  retries: 0,
  timeout: target.scope === 'idle-expiry' ? 19 * 60_000 : 90_000,
  globalTimeout: target.scope === 'idle-expiry' ? 22 * 60_000 : 5 * 60_000,
  expect: { timeout: 20_000 },
  reporter: 'list',
  outputDir: './test-results/staging',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: target.origin,
    ignoreHTTPSErrors: false,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    acceptDownloads: false,
  },
});
