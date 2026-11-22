import { expect, test, type Locator } from '@playwright/test';

const variants = [
  { light: 'athlete-workouts.webp', dark: 'athlete-workouts-dark.webp' },
  { light: 'coach-workspace.webp', dark: 'coach-workspace-dark.webp' },
] as const;

async function imageHasLoaded(image: Locator) {
  return image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
}

for (const width of [320, 1280]) {
  test(`product previews fetch only selected images at ${width}px`, async ({ page }) => {
    const requested = new Set<string>();
    page.on('request', (request) => {
      const url = decodeURIComponent(request.url());
      for (const variant of variants) {
        if (url.includes('/product-previews/' + variant.light)) requested.add(variant.light);
        if (url.includes('/product-previews/' + variant.dark)) requested.add(variant.dark);
      }
    });

    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');

    const region = page.getByRole('region', { name: 'Платформа для твоїх цілей' });
    const cards = region.getByRole('article');
    await expect(cards).toHaveCount(2);

    for (const [index, variant] of variants.entries()) {
      const card = cards.nth(index);
      const image = card.locator('img.landing-product-preview--light');
      await image.scrollIntoViewIfNeeded();
      await expect(image).toBeVisible();
      await expect.poll(() => imageHasLoaded(image)).toBe(true);
      await expect(card.locator('img.landing-product-preview--dark')).toBeHidden();
      await expect(image).toHaveAttribute('loading', 'lazy');
      const priority = index === 0 ? 'high' : 'auto';
      await expect(image).toHaveAttribute('fetchpriority', priority);
      expect(requested.has(variant.light)).toBe(true);
      expect(requested.has(variant.dark)).toBe(false);
    }
    expect(requested.size).toBe(2);

    const preloads = await page.locator('link[rel="preload"][as="image"]').all();
    for (const link of preloads) {
      const href = (await link.getAttribute('href')) ?? '';
      const srcset = (await link.getAttribute('imagesrcset')) ?? '';
      expect(decodeURIComponent(href + srcset)).not.toContain('/product-previews/');
    }

    await page.getByRole('combobox', { name: 'Тема інтерфейсу' }).selectOption('dark');
    for (const [index, variant] of variants.entries()) {
      const image = cards.nth(index).locator('img.landing-product-preview--dark');
      await image.scrollIntoViewIfNeeded();
      await expect(image).toBeVisible();
      await expect.poll(() => imageHasLoaded(image)).toBe(true);
      expect(requested.has(variant.dark)).toBe(true);
    }
    expect(requested.size).toBe(4);
    const noOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= innerWidth + 1;
    });
    expect(noOverflow).toBe(true);
  });
}
