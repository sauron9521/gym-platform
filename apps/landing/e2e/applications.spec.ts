import { expect, test } from '@playwright/test';

test('apps directory reaches both products without fake release links', async ({ page }) => {
  await page.goto('/apps');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Web і Mobile');
  await page.getByRole('link', { name: 'Дізнатися про Mobile' }).click();
  await expect(page).toHaveURL(/\/apps\/mobile$/);
  await expect(page.getByText('Статус: у розробці')).toBeVisible();
  await page.getByRole('link', { name: 'Про Web' }).click();
  await expect(page).toHaveURL(/\/apps\/web$/);
  await expect(page.getByText('Статус: у розробці')).toBeVisible();
});
