import { expect, test } from '@playwright/test';

for (const { width, theme } of [
  { width: 320, theme: 'light' },
  { width: 1280, theme: 'dark' },
] as const) {
  test(`marketing entrance and hover treatment at ${width}px / ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
    await page.goto('/');

    const copy = page.locator('.landing-hero-copy');
    const visual = page.locator('.landing-hero-visual');
    await expect(copy).toHaveCSS('animation-name', 'landing-rise-in');
    await expect(visual).toHaveCSS('animation-name', 'landing-rise-in');

    const cards = page.locator('.landing-product-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toHaveCSS('transition-property', /transform/);

    const cta = page.locator('.landing-cta-surface');
    await expect(cta).toHaveCount(1);
    await expect(cta.locator('.landing-cta-action')).toHaveCount(2);
    await expect(cta.getByRole('link').first()).toHaveAttribute('href', '/apps');

    const widthOfDocument = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(widthOfDocument).toBeLessThanOrEqual(width + 1);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
  });

  test(`reduced motion keeps the marketing content static at ${width}px / ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/');

    await expect(page.locator('.landing-hero-copy')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.landing-hero-visual')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.landing-hero-copy')).toHaveCSS('opacity', '1');

    const product = page.locator('.landing-product-card').first();
    await expect(product).toHaveCSS('transition-property', 'none');
    await product.scrollIntoViewIfNeeded();
    await product.hover();
    await expect(product).toHaveCSS('transform', 'none');

    const ctaLink = page.locator('.landing-cta-action').first();
    await ctaLink.scrollIntoViewIfNeeded();
    await ctaLink.hover();
    await expect(ctaLink).toHaveCSS('transform', 'none');

    await expect(page.getByRole('main').getByRole('link', { name: 'Для атлетів' })).toHaveAttribute(
      'href',
      '/for-athletes',
    );
  });
}
