import { expect, test } from '@playwright/test';

for (const { width, theme } of [
  { width: 320, theme: 'light' },
  { width: 1280, theme: 'dark' },
] as const) {
  test(`home sections reveal progressively at ${width}px / ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
    await page.goto('/');

    const main = page.getByRole('main');
    const sectionHeadings = page.locator('.landing-section-heading');
    const reveals = page.locator('.landing-scroll-reveal');
    await expect(sectionHeadings).toHaveCount(2);
    await expect(reveals).toHaveCount(5);

    const browserSupportsViewTimeline = await page.evaluate(() =>
      CSS.supports('animation-timeline: view()'),
    );
    const expectedAnimation = browserSupportsViewTimeline ? 'landing-scroll-entrance' : 'none';

    for (const section of await reveals.all()) {
      await expect(section).toHaveCSS('animation-name', expectedAnimation);
      await section.scrollIntoViewIfNeeded();
      await expect(section).toBeVisible();
    }

    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(main.getByRole('link', { name: 'Для атлетів' })).toHaveAttribute(
      'href',
      '/for-athletes',
    );
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width + 1);
  });

  test(`reduced motion leaves every homepage section static at ${width}px / ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/');

    const reveals = page.locator('.landing-scroll-reveal');
    await expect(reveals).toHaveCount(5);
    for (const section of await reveals.all()) {
      await expect(section).toHaveCSS('animation-name', 'none');
      await expect(section).toHaveCSS('opacity', '1');
      await expect(section).toHaveCSS('transform', 'none');
    }

    const cards = page.locator('.landing-product-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.first().getByRole('link')).toHaveAttribute('href', '/for-athletes');
    await expect(cards.last().getByRole('link')).toHaveAttribute('href', '/for-trainers');
    await expect(page.locator('.landing-cta-surface').getByRole('link').first()).toHaveAttribute(
      'href',
      '/apps',
    );
  });
}
