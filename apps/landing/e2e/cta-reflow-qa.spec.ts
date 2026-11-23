import { expect, test } from '@playwright/test';

const cases = [
  { route: '/', hrefs: ['/apps', '/about'] },
  { route: '/apps/web', hrefs: ['/for-athletes', '/apps/mobile'] },
  { route: '/apps/mobile', hrefs: ['/for-athletes', '/apps/web'] },
] as const;

for (const { route, hrefs } of cases) {
  for (const { width, theme } of [
    { width: 320, theme: 'light' },
    { width: 390, theme: 'dark' },
  ] as const) {
    test(`CTA text reflows without clipping on ${route} at ${width}px / ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(route);

      const cta = page.locator('main .landing-cta-surface');
      await expect(cta.getByRole('heading', { level: 2 })).toBeVisible();
      const actions = cta.locator('a.landing-cta-action');
      await expect(actions).toHaveCount(2);

      for (const [index, href] of hrefs.entries()) {
        const action = actions.nth(index);
        await action.scrollIntoViewIfNeeded();
        await expect(action).toBeVisible();
        await expect(action).toHaveAttribute('href', href);
        await expect(action).toHaveAccessibleName(/\S/);
        const metrics = await action.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            widthOverflow: element.scrollWidth - element.clientWidth,
            height: rect.height,
            left: rect.left,
            right: rect.right,
          };
        });

        expect(metrics.widthOverflow).toBeLessThanOrEqual(1);
        expect(metrics.height).toBeGreaterThanOrEqual(44);
        expect(metrics.left).toBeGreaterThanOrEqual(0);
        expect(metrics.right).toBeLessThanOrEqual(width + 1);
      }

      const documentOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(documentOverflow).toBeLessThanOrEqual(1);
    });
  }
}

test('wrapped app CTA actions remain keyboard reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/apps/web');

  const cta = page.locator('main .landing-cta-surface');
  const primary = cta.locator('a[href="/for-athletes"]');
  const secondary = cta.locator('a[href="/apps/mobile"]');

  await primary.focus();
  await expect(primary).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(secondary).toBeFocused();
  await secondary.press('Enter');
  await expect(page).toHaveURL(/\/apps\/mobile$/);
});
