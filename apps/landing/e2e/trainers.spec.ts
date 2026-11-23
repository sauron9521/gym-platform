import { expect, test } from '@playwright/test';

for (const width of [320, 1280]) {
  test(`trainer workflows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/for-trainers');

    const main = page.getByRole('main');
    const heading = main.getByRole('heading', { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toContainText('Більше уваги спортсменам');
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
    await expect(main.getByText(/Публічний запуск ще не оголошено/)).toBeVisible();
    await expect(main.getByText('Статус: у розробці')).toBeVisible();
    const coachCta = main.getByRole('region', { name: 'OVRANTO Coach готується до запуску' });
    await expect(coachCta).toBeVisible();

    const featuresLink = main.getByRole('link', { name: 'Можливості платформи', exact: true });
    const appsLink = main.getByRole('link', { name: 'Каталог продуктів', exact: true });
    const overviewLink = main.getByRole('link', { name: 'Усі можливості', exact: true });
    await expect(featuresLink).toHaveAttribute('href', '/features');
    await expect(appsLink).toHaveAttribute('href', '/apps');
    await expect(overviewLink).toHaveAttribute('href', '/features');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://gym.example.test/for-trainers',
    );

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width);
  });
}

test('trainer CTA leads to public product discovery', async ({ page }) => {
  await page.goto('/for-trainers');
  const main = page.getByRole('main');
  await main.getByRole('link', { name: 'Каталог продуктів', exact: true }).click();
  await expect(page).toHaveURL(/\/apps$/);
  await expect(page.getByRole('main')).toBeVisible();
});
