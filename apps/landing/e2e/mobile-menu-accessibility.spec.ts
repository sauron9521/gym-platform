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
  await page
    .getByRole('navigation', { name: 'Мобільна навігація' })
    .getByRole('link', { name: 'Спортсменам' })
    .click();
  await expect(page).toHaveURL(/\/for-athletes$/);
  await expect(details).not.toHaveAttribute('open', '');
});

test('outside pointer and keyboard focus exit dismiss the open mobile menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.locator('header details');
  const summary = menu.locator('summary');

  await summary.click();
  await expect(menu).toHaveAttribute('open', '');
  await page.getByRole('main').getByRole('heading', { level: 1 }).click();
  await expect(menu).not.toHaveAttribute('open', '');

  await summary.click();
  await expect(menu).toHaveAttribute('open', '');
  await summary.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(menu).not.toHaveAttribute('open', '');
});

test('open mobile menu resets when the viewport crosses desktop breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.locator('header details');
  await menu.locator('summary').click();
  await expect(menu).toHaveAttribute('open', '');

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(menu).not.toHaveAttribute('open', '');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(menu).not.toHaveAttribute('open', '');
  await expect(menu.locator('summary')).toBeVisible();
});
