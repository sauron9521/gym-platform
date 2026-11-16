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
