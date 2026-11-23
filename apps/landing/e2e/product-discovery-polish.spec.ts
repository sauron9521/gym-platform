import { expect, test } from '@playwright/test';

for (const { width, theme } of [
  { width: 320, theme: 'light' },
  { width: 1280, theme: 'dark' },
] as const) {
  test(`product discovery remains readable at ${width}px / ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/');

    const discovery = page.getByRole('region', { name: 'Платформа для твоїх цілей' });
    const cards = discovery.getByRole('article');
    await expect(cards).toHaveCount(2);

    for (const [index, product, label, href] of [
      [0, 'OVRANTO Athlete', 'Можливості спортсмена', '/for-athletes'],
      [1, 'OVRANTO Coach', 'Можливості тренера', '/for-trainers'],
    ] as const) {
      const card = cards.nth(index);
      await expect(card.getByRole('heading', { name: product })).toBeVisible();
      await expect(card.getByText('У розробці')).toBeVisible();
      await expect(card.getByRole('listitem')).toHaveCount(3);

      const screenshot = card.locator(`img.landing-product-preview--${theme}`);
      const alternate = card.locator(
        `img.landing-product-preview--${theme === 'light' ? 'dark' : 'light'}`,
      );
      await screenshot.scrollIntoViewIfNeeded();
      await expect(screenshot).toBeVisible();
      await expect(alternate).toBeHidden();
      await expect(card.getByText(/не реальна статистика користувачів/)).toBeVisible();

      const action = card.getByRole('link', { name: label, exact: true });
      await expect(action).toHaveAttribute('href', href);
      await expect(action).toBeVisible();
      const targetHeight = await action.evaluate((node) => node.getBoundingClientRect().height);
      expect(targetHeight).toBeGreaterThanOrEqual(44);
      await expect(action.locator('[data-slot="landing-product-arrow"]')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    }

    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    expect(noOverflow).toBe(true);
  });
}

test('product discovery CTA arrow responds to pointer and keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');

  const athlete = page.getByRole('article').first();
  const action = athlete.getByRole('link', { name: 'Можливості спортсмена' });
  const arrow = action.locator('[data-slot="landing-product-arrow"]');
  await action.scrollIntoViewIfNeeded();
  await action.hover();
  await expect(arrow).toHaveCSS('translate', /4px/);

  await page.mouse.move(0, 0);
  await action.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(action).toBeFocused();
  await expect(arrow).toHaveCSS('translate', /4px/);
  await action.press('Enter');
  await expect(page).toHaveURL(/\/for-athletes$/);
});

test('reduced motion removes product CTA arrow movement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const action = page.getByRole('article').first().getByRole('link', {
    name: 'Можливості спортсмена',
  });
  await action.hover();
  const arrow = action.locator('[data-slot="landing-product-arrow"]');
  await expect(arrow).toHaveCSS('translate', 'none');
  await expect(arrow).toHaveCSS('transition-duration', '0s');
});
