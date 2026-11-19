import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { mockVisualDashboardAnalytics } from '../support/mock-visual-dashboard-analytics';

// These captures produce review evidence, not committed golden images.
// Normal PR CI skips the visual-review matrix to prevent flaky screenshot gates.
const captureEnabled = process.env.OVRANTO_VISUAL_CAPTURE === '1';
const viewports = [
  { width: 390, height: 844, label: 'mobile' },
  { width: 1280, height: 900, label: 'desktop' },
] as const;

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(name);
  await page.screenshot({ path, fullPage: true, animations: 'disabled', caret: 'hide' });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

test.describe('OVRANTO visual review (manual, opt-in)', () => {
  test.skip(!captureEnabled, 'Enable OVRANTO_VISUAL_CAPTURE=1 to generate review screenshots.');

  for (const locale of ['uk', 'en'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      for (const viewport of viewports) {
        test(`${locale}/${theme}/${viewport.label}`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.goto('/login');
          await page.context().addCookies([
            { name: 'gym-locale', value: locale, url: page.url() },
            { name: 'ovranto-theme', value: theme, url: page.url() },
          ]);
          await page.reload();

          await expect(page.locator('html')).toHaveAttribute('lang', locale);
          await expect(page.locator('html')).toHaveClass(new RegExp(`(^| )${theme}( |$)`));
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

          await attachScreenshot(page, testInfo, 'login.png');

          // Show filled analytics instead of 404 error banners in visual evidence.
          await mockVisualDashboardAnalytics(page);

          await page.getByLabel('Електронна пошта').fill('athlete@example.test');
          await page.getByLabel('Пароль').fill('TestPassword123!');
          await page.getByRole('button', { name: 'Увійти' }).click();
          await expect(page).toHaveURL(/\/dashboard$/);
          await expect(page.getByTestId('athlete-shell-header')).toBeVisible();
          await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
          await expect(
            page.locator('[aria-labelledby="dashboard-volume-heading"] [role="img"]'),
          ).toBeVisible();
          await expect(page.getByText('3', { exact: true })).toBeVisible();

          await attachScreenshot(page, testInfo, 'athlete-dashboard.png');

          await page.goto('/workouts');
          await expect(page.getByTestId('athlete-shell-header')).toBeVisible();
          await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

          await attachScreenshot(page, testInfo, 'athlete-workouts.png');
        });
      }
    }
  }
});
