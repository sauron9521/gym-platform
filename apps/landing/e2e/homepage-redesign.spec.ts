import { expect, test } from '@playwright/test';

for (const width of [320, 1280]) {
  test(`homepage preview and conversion CTAs are usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole('img', { name: /Умовний макет тренувального плану/ }),
    ).toBeVisible();
    await expect(page.getByText('Макет')).toBeVisible();
    await expect(page.getByText(/не реальні дані спортсмена/)).toBeVisible();

    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: 'Переглянути продукти' })).toHaveAttribute(
      'href',
      '/apps',
    );
    await expect(main.getByRole('link', { name: 'Про проєкт' })).toHaveAttribute(
      'href',
      '/about',
    );

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width);
  });
}
