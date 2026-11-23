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

    await expect(main.getByText(/Публічний запуск цих продуктів ще не оголошено/)).toBeVisible();
    await expect(main.getByText('Статус: у розробці')).toBeVisible();

    const featuresLink = main.getByRole('link', {
      name: 'Переглянути можливості',
      exact: true,
    });
    const athleteWebLink = main.getByRole('link', { name: 'Про Athlete Web', exact: true });
    const athleteMobileLink = main.getByRole('link', {
      name: 'Про Athlete Mobile',
      exact: true,
    });
    await expect(featuresLink).toHaveAttribute('href', '/features');
    await expect(athleteWebLink).toHaveAttribute('href', '/apps/web');
    await expect(athleteMobileLink).toHaveAttribute('href', '/apps/mobile');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://gym.example.test/for-athletes',
    );

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width);
  });
}

for (const product of [
  { label: 'Про Athlete Web', route: '/apps/web' },
  { label: 'Про Athlete Mobile', route: '/apps/mobile' },
] as const) {
  test(`athlete CTA opens the ${product.label} overview without signup`, async ({ page }) => {
    await page.goto('/for-athletes');
    await page.getByRole('main').getByRole('link', { name: product.label }).click();
    await expect(page).toHaveURL((url) => url.pathname === product.route);
    await expect(page.getByRole('main').getByText('Статус: у розробці')).toBeVisible();
  });
}
