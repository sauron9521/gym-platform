import { defineConfig, devices } from '@playwright/test';

const adminOrigin = 'http://localhost:3310';
const apiOrigin = 'http://127.0.0.1:3311';

/**
 * Real Chromium + real Next.js rewrite; upstream API is deterministic.
 * Real DB/session revocation and origin guards stay covered by API HTTP/Postgres E2E.
 */
export default defineConfig({
  testDir: './e2e/specs',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  globalTimeout: process.env.CI ? 8 * 60_000 : undefined,
  expect: { timeout: 15_000 },
  reporter: 'list',
  outputDir: './test-results/browser',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: adminOrigin,
    locale: 'uk-UA',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(process.env.ADMIN_E2E_CHROME_PATH
      ? {
          launchOptions: {
            executablePath: process.env.ADMIN_E2E_CHROME_PATH,
            args: ['--no-sandbox'],
          },
        }
      : {}),
  },
  webServer: [
    {
      name: 'admin-fixture-api',
      command: 'node e2e/support/mock-api.mjs',
      url: apiOrigin + '/__health',
      reuseExistingServer: false,
      timeout: 30_000,
      env: { ADMIN_E2E_API_PORT: '3311' },
    },
    {
      name: 'admin-next-rewrite',
      command: 'pnpm exec next dev --hostname localhost --port 3310',
      url: adminOrigin + '/sign-in',
      reuseExistingServer: false,
      timeout: 180_000,
      env: { GYM_API_INTERNAL_URL: apiOrigin, NEXT_TELEMETRY_DISABLED: '1' },
    },
  ],
});
