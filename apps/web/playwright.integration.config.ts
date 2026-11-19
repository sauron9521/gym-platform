import { defineConfig, devices } from '@playwright/test';

const database = process.env.TEST_DATABASE_URL;
if (!database || database !== process.env.DATABASE_URL) {
  throw new Error('Integration browser tests require identical DATABASE_URL and TEST_DATABASE_URL');
}
const url = new URL(database);
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  !decodeURIComponent(url.pathname).endsWith('_test')
) {
  throw new Error('Integration browser tests require a local disposable *_test database');
}

const webOrigin = 'http://127.0.0.1:3200';
const apiOrigin = 'http://127.0.0.1:3201';

export default defineConfig({
  testDir: './e2e/integration',
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  outputDir: './test-results/integration',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: webOrigin,
    locale: 'uk-UA',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      name: 'real-api',
      command: 'pnpm --filter @gym/api start:prod',
      cwd: '../..',
      url: `${apiOrigin}/health/live`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: '3201',
        APP_URL: webOrigin,
        CORS_ORIGINS: webOrigin,
        JWT_ISSUER: webOrigin,
      },
    },
    {
      name: 'next-web',
      command: 'pnpm exec next dev --hostname 127.0.0.1 --port 3200',
      url: `${webOrigin}/login`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { GYM_API_INTERNAL_URL: apiOrigin },
    },
  ],
});
