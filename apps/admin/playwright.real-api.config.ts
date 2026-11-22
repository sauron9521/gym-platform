import { defineConfig, devices } from '@playwright/test';

const database = process.env.TEST_DATABASE_URL;
if (!database || database !== process.env.DATABASE_URL || process.env.NODE_ENV !== 'test') {
  throw new Error('Real Admin browser tests require matching disposable test database URLs');
}
const url = new URL(database);
const local = ['localhost', '127.0.0.1'].includes(url.hostname);
const ciService = process.env.CI === 'true' && url.hostname === 'postgres' && url.port === '5432';
if (url.pathname !== '/gym_admin_browser_test' || (!local && !ciService)) {
  throw new Error('Admin browser tests refuse non-disposable or unapproved database');
}

const adminOrigin = 'http://localhost:3320';
const apiOrigin = 'http://127.0.0.1:3321';

export default defineConfig({
  testDir: './e2e/real-api',
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: 'list',
  outputDir: './test-results/real-api',
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
      name: 'real-nest-api',
      command: 'pnpm --filter @gym/api start:prod',
      cwd: '../..',
      url: apiOrigin + '/health/live',
      reuseExistingServer: false,
      timeout: 90_000,
      env: {
        NODE_ENV: 'test',
        PORT: '3321',
        APP_URL: adminOrigin,
        ADMIN_APP_URL: adminOrigin,
        CORS_ORIGINS: adminOrigin,
        JWT_ISSUER: adminOrigin,
        SUPERADMIN_USER_IDS: '00000000-0000-4000-8000-000000000099',
        JWT_SECRET: 'admin-browser-test-only-secret-987654321',
        MAIL_FROM: 'Admin Browser Test <no-reply@example.test>',
        ENABLE_OPENAPI: 'false',
      },
    },
    {
      name: 'real-next-admin',
      command: 'pnpm exec next dev --hostname localhost --port 3320',
      url: adminOrigin + '/sign-in',
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        GYM_API_INTERNAL_URL: apiOrigin,
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
});
