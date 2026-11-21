import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page, baseURL }) => {
  await page
    .context()
    .addCookies([{ name: 'gym-locale', value: 'en', url: baseURL ?? 'http://127.0.0.1:3100' }]);
});

test('missing email token is localized and never triggers a verification request', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/backend/auth/email/verify', (route) => {
    calls += 1;
    return route.fulfill({ status: 200, json: {} });
  });

  await page.goto('/verify-email');
  await expect(page).toHaveTitle('Verify your email | OVRANTO');
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  await expect(page.locator('main [role="alert"]')).toContainText('invalid or missing token');
  await expect(page.getByRole('link', { name: 'Request a new email' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify email' })).toHaveCount(0);
  expect(calls).toBe(0);
});

test('email verification strips the one-time token, translates errors and consumes only on click', async ({
  page,
}) => {
  const token = 'opaque-email-token-e2e';
  let calls = 0;
  await page.route('**/backend/auth/email/verify', (route) => {
    calls += 1;
    expect(route.request().postDataJSON()).toEqual({ token });
    return route.fulfill({
      status: calls === 1 ? 400 : 200,
      json: { message: 'INTERNAL_DIAGNOSTIC_DO_NOT_SHOW' },
    });
  });

  await page.goto('/verify-email?token=' + token);
  await expect(page).toHaveTitle('Verify your email | OVRANTO');
  await expect(page).toHaveURL(/\/verify-email$/);
  expect(calls).toBe(0);

  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(page.locator('main [role="alert"]')).toContainText(
    'invalid, already used or expired',
  );
  await expect(page.getByText('INTERNAL_DIAGNOSTIC_DO_NOT_SHOW')).toHaveCount(0);
  expect(calls).toBe(1);

  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(page.getByRole('status')).toContainText('Email verified');
  expect(calls).toBe(2);
  await expect(page).toHaveURL(/\/verify-email$/);
});

test('resend localizes status-only errors and requires no user-entered email', async ({ page }) => {
  let calls = 0;
  await page.route('**/backend/auth/email/verification', (route) => {
    calls += 1;
    return route.fulfill({
      status: calls === 1 ? 401 : calls === 2 ? 429 : 202,
      json: { message: 'INTERNAL_DIAGNOSTIC_DO_NOT_SHOW' },
    });
  });

  await page.goto('/verify-email/resend');
  await expect(page).toHaveTitle('Resend verification email | OVRANTO');
  await expect(page.getByRole('heading', { name: 'Resend verification email' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);

  await page.getByRole('button', { name: 'Resend verification' }).click();
  await expect(page.locator('main [role="alert"]')).toContainText('Sign in to your account');
  expect(calls).toBe(1);

  await page.getByRole('button', { name: 'Resend verification' }).click();
  await expect(page.locator('main [role="alert"]')).toContainText('Too many requests');
  expect(calls).toBe(2);

  await page.getByRole('button', { name: 'Resend verification' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Your request to resend the email was accepted',
  );
  await expect(page.getByText('INTERNAL_DIAGNOSTIC_DO_NOT_SHOW')).toHaveCount(0);
  expect(calls).toBe(3);
});
