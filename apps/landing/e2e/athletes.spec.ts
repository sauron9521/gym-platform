import { expect, test } from '@playwright/test';

test('athlete page exposes a useful journey and an application link', async ({ page }) => {
  await page.goto('/for-athletes');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Твоє тренування');
  await expect(page.getByRole('heading', { name: 'Від ідеї до тренувального плану' })).toBeVisible();
  await page.getByRole('link', { name: 'Застосунки платформи' }).click();
  await expect(page).toHaveURL(/\/apps$/);
});
