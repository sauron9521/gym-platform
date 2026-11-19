import { expect, test } from '@playwright/test';

import { mockVisualDashboardAnalytics } from '../support/mock-visual-dashboard-analytics';

test('synthetic visual dashboard analytics render a graph and record count', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockVisualDashboardAnalytics(page);
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill('athlete@example.test');
  await page.getByLabel('Пароль').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Увійти' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.locator('[aria-labelledby="dashboard-volume-heading"] [role="img"]'),
  ).toBeVisible();
  await expect(page.getByText('3', { exact: true })).toBeVisible();
  // Next.js Dev Tools announces the page title outside <main> in dev mode.
  // Only an alert in the actual dashboard content signals an error state.
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});
