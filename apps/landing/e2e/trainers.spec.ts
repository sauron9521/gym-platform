import { expect, test } from '@playwright/test';

test('trainer page presents real product scenarios and destinations', async ({ page }) => {
  await page.goto('/for-trainers');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Більше уваги спортсменам');
  await expect(page.getByRole('heading', { name: 'Програми та версії' })).toBeVisible();
  await page.getByRole('link', { name: 'Про вебзастосунок' }).click();
  await expect(page).toHaveURL(/\/apps\/web$/);
});
