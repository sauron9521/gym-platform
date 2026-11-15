import { defineConfig, devices } from '@playwright/test';

const host = '127.0.0.1';
const webPort = 3100;
const apiPort = 3101;
const webOrigin = `http://${host}:${webPort}`;
const apiOrigin = `http://${host}:${apiPort}`;

/**
 * Run the real Next.js UI against a deterministic loopback-only HTTP API.
 * Real NestJS/PostgreSQL integration is covered by the separate API E2E suite.
 */
export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  // Bound the entire CI browser suite, not just individual tests/retries.
  globalTimeout: process.env.CI ? 10 * 60_000 : undefined,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: './test-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: webOrigin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      name: 'fixture-api',
      command: 'node e2e/support/mock-api.mjs',
      url: `${apiOrigin}/__health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { E2E_API_PORT: String(apiPort) },
    },
    {
      name: 'next-web',
      command: `pnpm exec next dev --hostname ${host} --port ${webPort}`,
      url: `${webOrigin}/login`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { GYM_API_INTERNAL_URL: apiOrigin },
    },
  ],
});
