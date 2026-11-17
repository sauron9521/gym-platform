import { expect, test } from '@playwright/test';

for (const width of [320, 1280]) {
  test(`athlete page explains the training journey at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/for-athletes');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(main.getByRole('heading', { level: 1 })).toContainText('Твоє тренування');
    await expect(
      main.getByRole('heading', { name: 'Від ідеї до тренувального плану' }),
    ).toBeVisible();

    for (const title of ['Підбери вправи', 'Сплануй заняття', 'Фіксуй результат']) {
      await expect(main.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }

    await expect(main.getByText(/Доступність функцій залежить від етапу розробки/)).toBeVisible();

    const featuresLink = main.getByRole('link', {
      name: 'Переглянути можливості',
      exact: true,
    });
    const appsLink = main.getByRole('link', {
      name: 'Застосунки платформи',
      exact: true,
    });
    await expect(featuresLink).toHaveAttribute('href', '/features');
    await expect(appsLink).toHaveAttribute('href', '/apps');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://gym.example.test/for-athletes',
    );

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width);
  });
}

test('athlete CTA leads to the real applications overview', async ({ page }) => {
  await page.goto('/for-athletes');
  const main = page.getByRole('main');
  await main.getByRole('link', { name: 'Застосунки платформи', exact: true }).click();
  await expect(page).toHaveURL(/\/apps$/);
  await expect(page.getByRole('main')).toBeVisible();
});
