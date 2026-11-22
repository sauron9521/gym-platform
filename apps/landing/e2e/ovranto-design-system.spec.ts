import { expect, test } from '@playwright/test';

for (const mode of ['light', 'dark'] as const) {
  test(
    'OVRANTO ' + mode + ' theme uses approved semantic palette and official brand mark',
    async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/');

      const palette = await page.evaluate(() => {
        const styles = getComputedStyle(document.documentElement);
        return {
          background: styles.getPropertyValue('--background').trim().toLowerCase(),
          foreground: styles.getPropertyValue('--foreground').trim().toLowerCase(),
          brandTeal: styles.getPropertyValue('--brand-teal').trim().toLowerCase(),
          brandTerracotta: styles.getPropertyValue('--brand-terracotta').trim().toLowerCase(),
          fontFamily: getComputedStyle(document.body).fontFamily,
        };
      });

      expect(palette.background).toBe(mode === 'light' ? '#f5f0e9' : '#111918');
      expect(palette.foreground).toBe(mode === 'light' ? '#292724' : '#f5f2ed');
      expect(palette.brandTeal).toBe('#075c55');
      expect(palette.brandTerracotta).toBe('#c76537');
      expect(palette.fontFamily.toLowerCase()).toContain('manrope');

      const logo = page.getByRole('link', { name: 'OVRANTO — головна сторінка' });
      await expect(logo).toBeVisible();
      await expect(logo.locator('svg[data-slot="brand-mark"] path')).toHaveCount(2);
      await expect(logo).toContainText('OVRANTO');

      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(
        page.getByRole('img', { name: /Умовний макет тренувального плану/ }),
      ).toBeVisible();
      await expect(page.getByText(/не реальні дані спортсмена/)).toBeVisible();
    },
  );
}

for (const width of [320, 390, 768, 1440]) {
  test(
    'OVRANTO layout and CTAs stay usable without horizontal overflow at ' + width + 'px',
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.locator('header [data-slot="brand-logo"]')).toBeVisible();
      const hero = page.getByRole('main');
      await expect(hero.getByRole('link', { name: 'Для атлетів' })).toBeVisible();
      await expect(hero.getByRole('link', { name: 'Для тренерів' })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        ),
      ).toBe(true);
    },
  );
}
