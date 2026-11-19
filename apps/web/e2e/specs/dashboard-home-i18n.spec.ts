import { expect, test } from '@playwright/test';

test('Dashboard home updates title and shortcuts for English without changing account data', async ({
  page,
}) => {
  await page.context().addCookies([
    { name: 'gym-locale', value: 'en', url: 'http://127.0.0.1:3100' },
  ]);
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill('athlete@example.test');
  await page.getByLabel('Пароль').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Увійти' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Dashboard | OVRANTO');
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome, Тестовий атлет!' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quick access' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open my programs' })).toHaveAttribute(
    'href',
    '/athlete/programs',
  );
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

  // A different locale changes interface copy, not the user's saved display name.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome, Тестовий атлет!' })).toBeVisible();
});
