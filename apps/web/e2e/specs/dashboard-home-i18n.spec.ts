import { expect, test } from '@playwright/test';

test('English dashboard home copy', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('combobox', { name: /^(Мова|Language)$/ }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.getByLabel('Email address').fill('athlete@example.test');
  await page.getByLabel('Password').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page).toHaveTitle('Dashboard | OVRANTO');
  await expect(page.getByRole('heading', { name: /^Welcome, / })).toContainText('Тестовий атлет');
  await expect(page.getByRole('heading', { name: 'Quick access' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open my programs' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /^Welcome, / })).toBeVisible();
});
