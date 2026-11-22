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
    await expect(main.getByRole('link', { name: 'Для атлетів' })).toHaveAttribute(
      'href',
      '/for-athletes',
    );
    await expect(main.getByRole('link', { name: 'Для тренерів' })).toHaveAttribute(
      'href',
      '/for-trainers',
    );
    await expect(main.getByRole('link', { name: 'Про проєкт' })).toHaveAttribute('href', '/about');

    const discovery = page.getByRole('region', { name: 'Платформа для твоїх цілей' });
    const products = discovery.getByRole('article');
    await expect(products).toHaveCount(2);
    await expect(products.nth(0).getByRole('heading', { name: 'OVRANTO Athlete' })).toBeVisible();
    await expect(products.nth(1).getByRole('heading', { name: 'OVRANTO Coach' })).toBeVisible();
    for (const [index, href, label] of [
      [0, '/for-athletes', 'Можливості спортсмена'],
      [1, '/for-trainers', 'Можливості тренера'],
    ] as const) {
      await expect(products.nth(index).getByText('У розробці')).toBeVisible();
      await expect(products.nth(index).getByRole('link', { name: label })).toHaveAttribute(
        'href',
        href,
      );
      await expect(products.nth(index).getByText(/Публічний доступ ще не оголошено/)).toBeVisible();
    }

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width);
  });
}
