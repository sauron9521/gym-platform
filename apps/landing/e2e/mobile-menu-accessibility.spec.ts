import { expect, test } from '@playwright/test';

test('mobile navigation closes on route selection and Escape restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const details = page.locator('header details');
  const summary = details.locator('summary');
  await summary.press('Enter');
  await expect(details).toHaveAttribute('open', '');
  await summary.press('Escape');
  await expect(details).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();
  await summary.press('Enter');
  await page.getByRole('navigation', { name: 'Мобільна навігація' })
    .getByRole('link', { name: 'Спортсменам' }).click();
  await expect(page).toHaveURL(/\/for-athletes$/);
  await expect(details).not.toHaveAttribute('open', '');
});
