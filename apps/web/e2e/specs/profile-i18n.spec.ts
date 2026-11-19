import { expect, test } from '@playwright/test';

test('English profile localizes validation, save states and avatar UI', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill('athlete@example.test');
  await page.getByLabel('Пароль').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('combobox', { name: 'Мова' }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.goto('/profile');

  await expect(page).toHaveTitle('My profile | Gym Platform');
  await expect(page.getByRole('heading', { name: 'My profile' })).toBeVisible();
  await expect(page.getByText('Email: athlete@example.test')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Profile photo' })).toBeVisible();

  await page.getByLabel('Height (cm)').fill('193.5');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Enter a valid height.')).toBeVisible();

  await page.getByLabel('Height (cm)').fill('193');
  await page.getByLabel('Display name').fill('English profile check');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Profile updated.' })).toBeVisible();

  await page.getByLabel('Choose a photo').setInputFiles({
    name: 'invalid.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg/>'),
  });
  await expect(page.getByText('Only PNG, JPEG or WebP files are allowed.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload photo' })).toBeDisabled();
});

test('English profile conflict keeps unsaved edits and does not leak server text', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill('athlete@example.test');
  await page.getByLabel('Пароль').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole('combobox', { name: 'Мова' }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.goto('/profile');
  const displayName = page.getByLabel('Display name');
  await expect(displayName).toBeVisible();
  let attempts = 0;
  await page.route('**/backend/users/me', (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    attempts += 1;
    return route.fulfill({
      status: 409,
      json: { message: 'PRIVATE_INTERNAL_RECORD' },
    });
  });
  await displayName.fill('Keep my English draft');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not complete the request.' }),
  ).toBeVisible();
  await expect(displayName).toHaveValue('Keep my English draft');
  await expect(page.getByText('PRIVATE_INTERNAL_RECORD')).toHaveCount(0);
  expect(attempts).toBe(1);
});
