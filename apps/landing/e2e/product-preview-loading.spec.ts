import { expect, test } from '@playwright/test';

const variants = [
  ['athlete-workouts.webp', 'athlete-workouts-dark.webp'],
  ['coach-workspace.webp', 'coach-workspace-dark.webp'],
] as const;

for (const width of [320, 1280]) {
  test(`only the selected product preview theme downloads at ${width}px`, async ({ page }) => {
    const requested = new Set<string>();
    page.on('request', (request) => {
      const url = decodeURIComponent(request.url());
      if (!url.includes('/product-previews/')) return;
      for (const pair of variants) {
        for (const filename of pair) {
          if (url.includes('/product-previews/' + filename)) requested.add(filename);
        }
      }
    });

    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');

    const products = page
      .getByRole('region', { name: 'Платформа для твоїх цілей' })
      .getByRole('article');
    await expect(products).toHaveCount(2);

    for (const [index, [light, dark]] of variants.entries()) {
      const card = products.nth(index);
      const active = card.locator('img.landing-product-preview--light');
      await active.scrollIntoViewIfNeeded();
      await expect(active).toBeVisible();
      await expect
        .poll(() =>
          active.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
        )
        .toBe(true);
      await expect(card.locator('img.landing-product-preview--dark')).toBeHidden();
      await expect(active).toHaveAttribute('loading', 'lazy');
      await expect(active).toHaveAttribute('fetchpriority', index === 0 ? 'high' : 'auto');
      expect(requested.has(light)).toBe(true);
      expect(requested.has(dark)).toBe(false);
    }
    expect(requested.size).toBe(2);
    const preloads = await page
      .locator('link[rel="preload"][as="image"]')
      .evaluateAll((links) =>
        links.map((link) => link.getAttribute('href') ?? link.getAttribute('imagesrcset') ?? ''),
      );
    expect(preloads.some((url) => url.includes('product-previews'))).toBe(false);

    await page.getByRole('combobox', { name: 'Тема інтерфейсу' }).selectOption('dark');
    for (const [index, [, dark]] of variants.entries()) {
      const active = products.nth(index).locator('img.landing-product-preview--dark');
      await active.scrollIntoViewIfNeeded();
      await expect(active).toBeVisible();
      await expect
        .poll(() =>
          active.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
        )
        .toBe(true);
      expect(requested.has(dark)).toBe(true);
    }
    expect(requested.size).toBe(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  });
}
