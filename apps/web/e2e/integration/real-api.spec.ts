import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('real API persists the profile and revokes the browser session', async ({ page }) => {
  const email = `browser-${randomUUID()}@example.test`;
  const password = 'BrowserTest123!';

  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);

  // Create a unique account through the real API; no DB reset or production fixtures.
  const registration = await page.request.post('/backend/auth/register', {
    data: { email, password },
    headers: { origin: 'http://127.0.0.1:3200' },
  });
  expect(registration.status()).toBe(201);
  await page.context().clearCookies();

  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(email)).toBeVisible();
  const cookies = await page.context().cookies();
  expect(
    cookies.some((cookie) => cookie.name === '__Host-sid' && cookie.httpOnly && cookie.secure),
  ).toBe(true);

  await page.goto('/profile');
  await page.locator('#displayName').fill('Browser Integration Athlete');
  await page.getByRole('button', { name: 'Зберегти зміни' }).click();
  await expect(page.getByText('Профіль оновлено.')).toBeVisible();
  await page.reload();
  await expect(page.locator('#displayName')).toHaveValue('Browser Integration Athlete');

  await page.goto('/trainer/programs');
  await expect(page.getByRole('heading', { name: 'Доступ заборонено' })).toBeVisible();
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Вийти' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);
});
