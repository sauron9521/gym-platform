import { expect, test } from '@playwright/test';

for (const width of [320, 1280]) {
  test(`application directory is usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/apps');

    const main = page.getByRole('main');
    const heading = main.getByRole('heading', { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toContainText('Athlete і Coach');
    await expect(main.getByRole('article')).toHaveCount(3);
    await expect(
      main.getByRole('heading', { name: 'OVRANTO Athlete Web', exact: true }),
    ).toBeVisible();
    await expect(
      main.getByRole('heading', { name: 'OVRANTO Athlete Mobile', exact: true }),
    ).toBeVisible();

    await expect(
      main.getByRole('heading', { name: 'OVRANTO Coach Web', exact: true }),
    ).toBeVisible();
    await expect(main.getByRole('article').getByText('У розробці')).toHaveCount(3);

    const webLink = main.getByRole('link', { name: 'Про Athlete Web', exact: true });
    const mobileLink = main.getByRole('link', { name: 'Про Athlete Mobile', exact: true });
    await expect(webLink).toHaveAttribute('href', '/apps/web');
    await expect(mobileLink).toHaveAttribute('href', '/apps/mobile');
    const coachLink = main.getByRole('link', { name: 'Про OVRANTO Coach', exact: true });
    await expect(coachLink).toHaveAttribute('href', '/for-trainers');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://gym.example.test/apps',
    );

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width);
  });
}

for (const app of [
  {
    path: '/apps/web',
    title: 'Тренувальна платформа у браузері',
    highlight: 'Каталог вправ',
    audience: 'Можливості для спортсменів',
    audienceDestination: '/for-athletes',
    other: 'Про Mobile',
    destination: '/apps/mobile',
  },
  {
    path: '/apps/mobile',
    title: 'Тренування під рукою',
    highlight: 'Мої тренування',
    audience: 'Можливості для спортсменів',
    audienceDestination: '/for-athletes',
    other: 'Про Web',
    destination: '/apps/web',
  },
] as const) {
  test(`${app.path} explains development status with honest navigation`, async ({ page }) => {
    await page.goto(app.path);

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: app.title })).toHaveCount(1);
    await expect(main.getByText('Статус: у розробці')).toBeVisible();
    await expect(main.getByText(/Реальні скриншоти інтерфейсу додамо/)).toBeVisible();
    await expect(main.getByRole('heading', { level: 3, name: app.highlight })).toBeVisible();
    await expect(main.getByRole('listitem')).toHaveCount(4);
    await expect(main.getByText(/а не обіцянку доступності/)).toBeVisible();
    await expect(main.getByRole('link', { name: app.audience })).toHaveAttribute(
      'href',
      app.audienceDestination,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://gym.example.test${app.path}`,
    );

    const otherApp = main.getByRole('link', { name: app.other, exact: true });
    await expect(otherApp).toHaveAttribute('href', app.destination);
    await otherApp.click();
    await expect(page).toHaveURL(new RegExp(`${app.destination}$`));
    await expect(page.getByRole('main')).toBeVisible();
  });
}

test('Coach product opens a truthful internal page, not an undeployed signup', async ({ page }) => {
  await page.goto('/apps');
  await page.getByRole('main').getByRole('link', { name: 'Про OVRANTO Coach' }).click();
  await expect(page).toHaveURL(/\/for-trainers$/);
  await expect(page.getByRole('main').getByText(/Публічний запуск ще не оголошено/)).toBeVisible();
});
