import { expect, test } from '@playwright/test';

for (const { width, theme } of [
  { width: 320, theme: 'light' },
  { width: 390, theme: 'dark' },
  { width: 1280, theme: 'light' },
  { width: 1280, theme: 'dark' },
] as const) {
  test(`final CTA remains clear and accessible at ${width}px / ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
    await page.goto('/');

    const cta = page.locator('.landing-cta-surface');
    await expect(cta).toBeVisible();
    await expect(cta.getByRole('heading', { level: 2 })).toHaveCount(1);
    const links = cta.locator('a.landing-cta-action');
    await expect(links).toHaveCount(2);

    for (const [index, href] of ['/apps', '/about'].entries()) {
      const link = links.nth(index);
      await expect(link).toHaveAttribute('href', href);
      await expect(link).toHaveAccessibleName(/\S/);
      const height = await link.evaluate((element) => element.getBoundingClientRect().height);
      expect(height).toBeGreaterThanOrEqual(44);
      await expect(link.locator('[data-slot="landing-cta-arrow"]')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });
}

test('final CTA arrow responds to hover and primary action remains navigable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');

  const primary = page.locator('.landing-cta-surface a[href="/apps"]');
  await primary.scrollIntoViewIfNeeded();
  const arrow = primary.locator('[data-slot="landing-cta-arrow"]');
  await primary.hover();
  await expect(arrow).toHaveCSS('translate', /4px/);
  await primary.focus();
  await expect(primary).toBeFocused();
  await primary.press('Enter');
  await expect(page).toHaveURL(/\/apps$/);
});

test('reduced-motion disables final CTA transforms but preserves both links', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('/');

  const cta = page.locator('.landing-cta-surface');
  const primary = cta.locator('a[href="/apps"]');
  await primary.scrollIntoViewIfNeeded();
  await primary.hover();

  await expect(primary).toHaveCSS('transform', 'none');
  const arrow = primary.locator('[data-slot="landing-cta-arrow"]');
  await expect(arrow).toHaveCSS('translate', 'none');
  await expect(arrow).toHaveCSS('transition-duration', '0s');
  await expect(cta.locator('a[href="/about"]')).toBeVisible();
});
