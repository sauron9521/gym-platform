import { expect, test } from '@playwright/test';

test('desktop navigation reaches public features without authentication', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Тренуйся розумніше');
  const nav = page.getByRole('navigation', { name: 'Основна навігація' });
  await nav.getByRole('link', { name: 'Можливості' }).click();
  await expect(page).toHaveURL(/\/features$/);
  await expect(page.getByRole('main')).toBeVisible();
});

test('SEO exposes canonical URLs and sitemap only for the configured HTTPS origin', async ({
  page,
}) => {
  await page.goto('/about');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://gym.example.test/about',
  );
  const robots = await page.request.get('/robots.txt');
  expect(robots.ok()).toBe(true);
  const sitemap = await page.request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain('https://gym.example.test/about');
});

test('narrow viewport offers usable keyboard-accessible navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.locator('header details');
  await menu.locator('summary').press('Enter');
  await expect(menu).toHaveAttribute('open', '');
  const mobile = page.getByRole('navigation', { name: 'Мобільна навігація' });
  await mobile.getByRole('link', { name: 'Про проєкт' }).press('Enter');
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole('main')).toBeVisible();
});

test('English browser preferences do not expose unfinished English routes or SEO alternates', async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Тренуйся розумніше');
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);

  const englishRoute = await page.request.get('/en');
  expect(englishRoute.status()).toBe(404);
});

test('OVRANTO brand logo and favicon retain official teal and terracotta strokes', async ({
  page,
}) => {
  await page.goto('/');

  const homeLink = page.getByRole('link', { name: 'OVRANTO — головна сторінка' });
  await expect(homeLink).toBeVisible();
  await expect(homeLink.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  await expect(homeLink).toContainText('OVRANTO');

  const favicon = await page.request.get('/icon.svg');
  expect(favicon.ok()).toBe(true);
  expect(favicon.headers()['content-type']).toContain('image/svg+xml');
  expect(await favicon.text()).toContain('viewBox="0 0 64 64"');
  expect(await favicon.text()).toContain('#075C55');
  expect(await favicon.text()).toContain('#C76537');
  expect(await favicon.text()).not.toContain('#c8ef5a');
});

for (const width of [390, 1280]) {
  test(`public product navigation stays internal at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');

    const products = page.getByRole('contentinfo').getByRole('navigation', {
      name: 'Застосунки',
    });
    for (const [label, href] of [
      ['OVRANTO Athlete Web', '/apps/web'],
      ['OVRANTO Athlete Mobile', '/apps/mobile'],
      ['OVRANTO Coach Web', '/for-trainers'],
    ] as const) {
      await expect(products.getByRole('link', { name: label, exact: true })).toHaveAttribute(
        'href',
        href,
      );
    }

    if (width < 1024) {
      const menu = page.locator('header details');
      await menu.locator('summary').press('Enter');
      await expect(menu).toHaveAttribute('open', '');
    }
    const entry = page.locator('header').getByRole('link', { name: 'Продукти', exact: true });
    await expect(entry).toHaveAttribute('href', '/apps');
    await entry.click();
    await expect(page).toHaveURL((url) => url.pathname === '/apps');
    await expect(page.getByRole('main').getByRole('article')).toHaveCount(3);
  });
}
