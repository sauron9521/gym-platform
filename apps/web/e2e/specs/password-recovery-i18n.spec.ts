import { expect, test } from '@playwright/test';

const englishCookie = {
  name: 'gym-locale',
  value: 'en',
  url: 'http://127.0.0.1:3100',
};

test('English recovery keeps account existence private', async ({ page }) => {
  await page.goto('/forgot-password');
  await page.getByRole('combobox', { name: 'Мова' }).selectOption('en');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Forgot your password? | OVRANTO');
  await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'OVRANTO' })).toBeVisible();

  let forgotRequests = 0;
  await page.route('**/backend/auth/password-reset/forgot', (route) => {
    forgotRequests += 1;
    return route.fulfill({ status: 202, json: {} });
  });

  await page.getByLabel('Email address').fill('not-registered@example.test');
  await page.getByRole('button', { name: 'Send instructions' }).click();
  await expect(page.getByRole('status')).toContainText(
    'If an account exists for that email address',
  );
  await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
  expect(forgotRequests).toBe(1);
});

test('English recovery rate limits hide API response bodies', async ({ page }) => {
  await page.context().addCookies([englishCookie]);
  await page.route('**/backend/auth/password-reset/forgot', (route) =>
    route.fulfill({ status: 429, json: { message: 'internal account details' } }),
  );

  await page.goto('/forgot-password');
  await page.getByLabel('Email address').fill('anyone@example.test');
  await page.getByRole('button', { name: 'Send instructions' }).click();
  await expect(page.getByText('Too many requests. Try again later.')).toBeVisible();
  await expect(page.getByText('internal account details')).toHaveCount(0);
});

test('reset strips token from URL and localizes errors', async ({ page }) => {
  await page.context().addCookies([englishCookie]);
  const token = 'opaque-recovery-token-e2e';
  let calls = 0;
  await page.route('**/backend/auth/password-reset/reset', async (route) => {
    calls += 1;
    const body = route.request().postDataJSON() as { token: string; password: string };
    expect(body.token).toBe(token);
    expect(body.password).toBe('Password123!');
    return route.fulfill({ status: calls === 1 ? 400 : 200, json: {} });
  });

  await page.goto('/reset-password?token=' + token);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Create a new password | OVRANTO');
  await expect(page).toHaveURL(/\/reset-password$/);
  expect(calls).toBe(0);

  await page.getByLabel('New password', { exact: true }).fill('Password123!');
  await page.getByLabel('Confirm password').fill('Different123!');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText('Passwords do not match.')).toBeVisible();
  expect(calls).toBe(0);

  await page.getByLabel('Confirm password').fill('Password123!');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText(/The link is invalid or expired/)).toBeVisible();
  expect(calls).toBe(1);

  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('status')).toContainText('Your password has been changed.');
  await expect(page).toHaveURL(/\/reset-password$/);
  expect(calls).toBe(2);
});

test('missing reset token shows a translated error', async ({ page }) => {
  await page.context().addCookies([englishCookie]);
  await page.goto('/reset-password');
  await expect(page.getByRole('alert')).toContainText('The reset link is missing or invalid.');
  await expect(page.getByRole('link', { name: 'Request a new link' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change password' })).toHaveCount(0);
});
