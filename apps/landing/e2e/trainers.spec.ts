import { expect, test } from '@playwright/test';

for (const width of [320, 1280]) {
  test(`trainer page explains programs and athlete workflows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/for-trainers');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(main.getByRole('heading', { level: 1 })).toContainText(
      'Більше уваги спортсменам',
    );
    await expect(
      main.getByRole('heading', { name: 'Структура, яка допомагає вести тренування' }),
    ).toBeVisible();

    for (const title of [
      'Організація спортсменів',
      'Програми та версії',
      'Спільна історія тренувань',
    ]) {
      await expect(main.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }
    await expect(main.getByText(/Функціонал доповнюється поступово/)).toBeVisible();

    const featuresLink = main.getByRole('link', { name: 'Можливості платформи', exact: true });
    const webLink = main.getByRole('link', { name: 'Про вебзастосунок', exact: true });
    const mobileLink = main.getByRole('link', { name: 'Про Mobile', exact: true });
    await expect(featuresLink).toHaveAttribute('href', '/features');
    await expect(webLink).toHaveAttribute('href', '/apps/web');
    await expect(mobileLink).toHaveAttribute('href', '/apps/mobile');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://gym.example.test/for-trainers',
    );

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width);
  });
}

test('trainer CTA leads to existing web application overview', async ({ page }) => {
  await page.goto('/for-trainers');
  const main = page.getByRole('main');
  await main.getByRole('link', { name: 'Про вебзастосунок', exact: true }).click();
  await expect(page).toHaveURL(/\/apps\/web$/);
  await expect(page.getByRole('main')).toBeVisible();
});
