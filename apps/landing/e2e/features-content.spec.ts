import { expect, test } from '@playwright/test';

for (const width of [320, 1280]) {
  test(`features page has four accessible capability cards and valid links at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/features');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(
      main.getByRole('heading', { name: 'Більше контролю над кожним тренуванням' }),
    ).toBeVisible();
    await expect(main.getByText(/Частина можливостей ще перебуває в розробці/)).toBeVisible();

    const cards = main.getByRole('article');
    await expect(cards).toHaveCount(4);
    for (const title of [
      'Бібліотека вправ',
      'Журнал тренувань',
      'Програми та версії',
      'Тренер і спортсмен',
    ]) {
      await expect(cards.getByRole('heading', { name: title })).toBeVisible();
    }
    await expect(main.getByRole('link', { name: 'Я спортсмен' })).toHaveAttribute(
      'href',
      '/for-athletes',
    );
    await expect(main.getByRole('link', { name: 'Я тренер' })).toHaveAttribute(
      'href',
      '/for-trainers',
    );
    await expect(main.getByRole('link', { name: 'Переглянути застосунки' })).toHaveAttribute(
      'href',
      '/apps',
    );

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://gym.example.test/features',
    );
  });
}

test('features CTA leads to an existing athlete page without suggesting product launch', async ({
  page,
}) => {
  await page.goto('/features');
  await page.getByRole('main').getByRole('link', { name: 'Я спортсмен' }).click();
  await expect(page).toHaveURL(/\/for-athletes$/);
  await expect(page.getByRole('main')).toBeVisible();
});
