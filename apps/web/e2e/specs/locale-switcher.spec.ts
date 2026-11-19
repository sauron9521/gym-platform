import { expect, test } from '@playwright/test';

test('login language switcher updates the SSR locale and preserves the route', async ({ page }) => {
  await page.goto('/login');

  const switcher = page.getByRole('combobox', { name: /^(Мова|Language)$/ });
  await switcher.selectOption('en');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();

  await page.getByRole('combobox', { name: 'Language' }).selectOption('uk');
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  await expect(page.getByRole('heading', { name: 'Вхід у кабінет' })).toBeVisible();

  const cookie = (await page.context().cookies()).find((item) => item.name === 'gym-locale');
  expect(cookie?.value).toBe('uk');
});

test('login shows accessible OVRANTO brand without horizontal overflow at 320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/login');

  const home = page.getByRole('link', { name: 'OVRANTO', exact: true });
  await expect(home).toHaveAttribute('href', '/');
  await expect(home.locator('[data-slot="brand-logo"]')).toBeVisible();
  await expect(home.locator('[data-slot="brand-mark"]')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByRole('combobox', { name: /^(Мова|Language)$/ })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
});
