import { expect, test, type Page } from '@playwright/test';

const cookieName = 'ovranto-theme';

async function palette(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    return {
      background: style.getPropertyValue('--background').trim().toLowerCase(),
      explicitLight: root.classList.contains('light'),
      explicitDark: root.classList.contains('dark'),
    };
  });
}

test('system follows OS and explicit Light/Dark persist across navigation and reload', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const theme = page.getByRole('combobox', { name: 'Тема інтерфейсу' });
  await expect(theme).toHaveValue('system');
  expect((await palette(page)).background).toBe('#111918');

  await theme.selectOption('light');
  await expect(theme).toHaveValue('light');
  expect(await palette(page)).toMatchObject({
    background: '#f5f0e9',
    explicitLight: true,
    explicitDark: false,
  });
  const cookie = (await context.cookies()).find((item) => item.name === cookieName);
  expect(cookie).toMatchObject({
    name: cookieName,
    value: 'light',
    sameSite: 'Lax',
    domain: '127.0.0.1',
    path: '/',
  });
  expect(cookie?.expires).toBeGreaterThan(Date.now() / 1000 + 3600);

  await page.goto('/features');
  expect(await palette(page)).toMatchObject({ background: '#f5f0e9', explicitLight: true });
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Тема інтерфейсу' })).toHaveValue('light');

  await page.getByRole('combobox', { name: 'Тема інтерфейсу' }).selectOption('dark');
  expect(await palette(page)).toMatchObject({ background: '#111918', explicitDark: true });
  await page.getByRole('combobox', { name: 'Тема інтерфейсу' }).selectOption('system');
  expect(await palette(page)).toMatchObject({
    background: '#111918',
    explicitDark: false,
    explicitLight: false,
  });
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await palette(page)).toMatchObject({
    background: '#f5f0e9',
    explicitDark: false,
    explicitLight: false,
  });
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Тема інтерфейсу' })).toHaveValue('system');
});

test('server HTML honors saved cookie before client hydration', async ({ page, context }) => {
  await context.addCookies([
    { name: cookieName, value: 'light', url: 'http://127.0.0.1:3302', sameSite: 'Lax' },
  ]);
  await page.emulateMedia({ colorScheme: 'dark' });
  const response = await page.goto('/');
  expect(response?.ok()).toBe(true);
  expect(await response!.text()).toMatch(/<html[^>]*class="light"/);
  expect(await palette(page)).toMatchObject({
    background: '#f5f0e9',
    explicitLight: true,
    explicitDark: false,
  });
  await expect(page.getByRole('combobox', { name: 'Тема інтерфейсу' })).toHaveValue('light');
});

test('invalid cookie falls back to OS theme with no stale explicit class', async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: cookieName, value: 'invalid', url: 'http://127.0.0.1:3302', sameSite: 'Lax' },
  ]);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'Тема інтерфейсу' })).toHaveValue('system');
  expect(await palette(page)).toMatchObject({
    background: '#111918',
    explicitDark: false,
    explicitLight: false,
  });
});

for (const width of [320, 390]) {
  test('control and compact wordmark remain usable at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'OVRANTO — головна сторінка' })).toBeVisible();
    const theme = page.getByRole('combobox', { name: 'Тема інтерфейсу' });
    await expect(theme).toBeVisible();
    await theme.selectOption('dark');
    expect((await palette(page)).background).toBe('#111918');
    await expect(page.locator('header details > summary')).toBeVisible();
    await expect(page.locator('header [data-slot=brand-logo] > span')).toBeHidden();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);
  });
}
