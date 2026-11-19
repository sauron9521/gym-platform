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

async function signInForLocaleTest(page: import('@playwright/test').Page, email: string) {
  await page.context().addCookies([
    { name: 'gym-locale', value: 'uk', url: 'http://127.0.0.1:3100' },
  ]);
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(email);
  await page.getByLabel('Пароль').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('combobox', { name: /^(Мова|Language)$/ })).toBeEnabled();
}

test('account locale persists across reload and login, overriding a guest cookie', async ({
  page,
}) => {
  await signInForLocaleTest(page, 'locale@example.test');
  await page.getByRole('combobox', { name: 'Мова' }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.getByRole('button', { name: /^(Вийти|Sign out)$/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('combobox', { name: 'Language' }).selectOption('uk');
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk');

  await page.getByLabel('Електронна пошта').fill('locale@example.test');
  await page.getByLabel('Пароль').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const cookie = (await page.context().cookies()).find((item) => item.name === 'gym-locale');
  expect(cookie?.value).toBe('en');
});

test('failed authenticated preference PATCH preserves locale and permits explicit retry', async ({
  page,
}) => {
  await signInForLocaleTest(page, 'locale-error@example.test');

  let patches = 0;
  await page.route('**/backend/users/me/preferences', (route) => {
    patches += 1;
    if (patches === 1) {
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    }
    return route.continue();
  });

  const switcher = page.getByRole('combobox', { name: /^(Мова|Language)$/ });
  await switcher.selectOption('en');
  const localeError = page.getByRole('alert').filter({ hasText: 'Не вдалося зберегти мову' });
  await expect(localeError).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  await expect(switcher).toHaveValue('uk');
  let cookie = (await page.context().cookies()).find((item) => item.name === 'gym-locale');
  expect(cookie?.value).toBe('uk');
  expect(patches).toBe(1);

  await switcher.selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  cookie = (await page.context().cookies()).find((item) => item.name === 'gym-locale');
  expect(cookie?.value).toBe('en');
  expect(patches).toBe(2);
});
