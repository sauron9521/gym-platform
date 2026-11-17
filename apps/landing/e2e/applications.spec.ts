import { expect, test } from '@playwright/test';

for (const width of [320, 1280]) {
  test(`application directory is usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/apps');

    const main = page.getByRole('main');
    const heading = main.getByRole('heading', { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toContainText('Web і Mobile');
    await expect(main.getByRole('article')).toHaveCount(2);
    await expect(
      main.getByRole('heading', { name: 'Gym Platform Web', exact: true }),
    ).toBeVisible();
    await expect(
      main.getByRole('heading', { name: 'Gym Platform Mobile', exact: true }),
    ).toBeVisible();

    const webLink = main.getByRole('link', { name: 'Дізнатися про Web', exact: true });
    const mobileLink = main.getByRole('link', { name: 'Дізнатися про Mobile', exact: true });
    await expect(webLink).toHaveAttribute('href', '/apps/web');
    await expect(mobileLink).toHaveAttribute('href', '/apps/mobile');
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
    audience: 'Можливості для тренерів',
    audienceDestination: '/for-trainers',
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
