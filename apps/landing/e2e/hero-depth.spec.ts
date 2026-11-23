import { expect, test } from '@playwright/test';

for (const { width, theme } of [
  { width: 320, theme: 'light' },
  { width: 390, theme: 'dark' },
  { width: 1280, theme: 'light' },
] as const) {
  test(`Hero layers keep public product information clear at ${width}px / ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
    await page.goto('/');

    const stage = page.locator('.landing-hero-stage');
    const browser = stage.locator('.landing-hero-browser');
    await expect(browser).toBeVisible();
    await expect(browser).toHaveAttribute('role', 'img');
    await expect(browser).toHaveAttribute('aria-label', /Умовний макет тренувального плану/);

    const layers = stage.locator('[data-hero-depth-layer]');
    await expect(layers).toHaveCount(2);
    await expect(layers.first()).toHaveAttribute('aria-hidden', 'true');
    await expect(layers.last()).toHaveAttribute('aria-hidden', 'true');

    const previews = page.locator('.landing-product-frame');
    await expect(previews).toHaveCount(2);
    const accent = previews.first().locator('div[aria-hidden="true"]').first();
    await expect(accent).toHaveCSS('height', '3px');
    await expect(accent).toHaveCSS('background-image', /linear-gradient/);
    await expect(page.getByText(/не реальні дані спортсмена/)).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Для атлетів' })).toHaveAttribute(
      'href',
      '/for-athletes',
    );

    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    expect(fits).toBe(true);
  });
}

test('Hero mockup lifts subtly on desktop pointer hover', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');

  const stage = page.locator('.landing-hero-stage');
  const browser = stage.locator('.landing-hero-browser');
  await expect(browser).toHaveCSS('translate', 'none');
  await stage.hover();
  await expect(browser).toHaveCSS('translate', /-4px/);
});

test('reduced motion keeps Hero depth static and accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('/');

  const stage = page.locator('.landing-hero-stage');
  const browser = stage.locator('.landing-hero-browser');
  await stage.hover();
  await expect(browser).toHaveCSS('translate', 'none');
  await expect(browser).toHaveCSS('transition-duration', '0s');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('main').getByRole('link', { name: 'Для тренерів' })).toHaveAttribute(
    'href',
    '/for-trainers',
  );
});
