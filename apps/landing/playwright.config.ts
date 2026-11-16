import { defineConfig, devices } from '@playwright/test';

const origin = 'http://127.0.0.1:3302';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  globalTimeout: process.env.CI ? 6 * 60_000 : undefined,
  expect: { timeout: 10_000 },
  reporter: 'list',
  outputDir: './test-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: origin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    name: 'landing-next',
    command: 'pnpm exec next dev --hostname 127.0.0.1 --port 3302',
    url: origin,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { LANDING_SITE_URL: 'https://gym.example.test' },
  },
});
