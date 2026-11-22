import { expect, test, type Page } from '@playwright/test';

async function expectThemeMatchedPreviews(page: Page, theme: 'light' | 'dark') {
  const discovery = page.getByRole('region', { name: 'Платформа для твоїх цілей' });
  const articles = discovery.getByRole('article');
  await expect(articles).toHaveCount(2);

  for (const [index, description] of ['OVRANTO Athlete', 'OVRANTO Coach'].entries()) {
    const article = articles.nth(index);
    const active = article.locator(`img.landing-product-preview--${theme}`);
    const inactive = article.locator(
      `img.landing-product-preview--${theme === 'light' ? 'dark' : 'light'}`,
    );
    await active.scrollIntoViewIfNeeded();
    await expect(active).toBeVisible();
    await expect(inactive).toBeHidden();
    await expect
      .poll(() => active.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    expect(await active.getAttribute('alt')).toContain(description);
    await expect(article.getByRole('img')).toHaveCount(1);
    await expect(article.getByText(/не реальна статистика користувачів/)).toBeVisible();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
}

for (const width of [320, 1280]) {
  test(`system preview follows OS preference at ${width}px without a page reload`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.getByRole('combobox', { name: 'Тема інтерфейсу' })).toHaveValue('system');
    await expectThemeMatchedPreviews(page, 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expectThemeMatchedPreviews(page, 'light');
  });

  test(`manual Light/Dark overrides OS and reload at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    const theme = page.getByRole('combobox', { name: 'Тема інтерфейсу' });
    await theme.selectOption('light');
    await expectThemeMatchedPreviews(page, 'light');
    await page.reload();
    await expect(theme).toHaveValue('light');
    await expectThemeMatchedPreviews(page, 'light');
    await page.emulateMedia({ colorScheme: 'light' });
    await theme.selectOption('dark');
    await expectThemeMatchedPreviews(page, 'dark');
    await page.reload();
    await expect(theme).toHaveValue('dark');
    await expectThemeMatchedPreviews(page, 'dark');
  });
}
