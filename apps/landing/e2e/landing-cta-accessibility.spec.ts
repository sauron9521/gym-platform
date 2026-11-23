import { expect, test } from '@playwright/test';

for (const { width, theme } of [
  { width: 320, theme: 'light' },
  { width: 1280, theme: 'dark' },
] as const) {
  test('Landing CTA stays keyboard reachable and touch-sized at ' + width + 'px', async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Тема інтерфейсу' }).selectOption(theme);

    const main = page.getByRole('main');
    const athlete = main.getByRole('link', { name: 'Для атлетів', exact: true });
    const coach = main.getByRole('link', { name: 'Для тренерів', exact: true });

    for (const [link, href] of [
      [athlete, '/for-athletes'],
      [coach, '/for-trainers'],
    ] as const) {
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', href);
      const height = await link.evaluate((element) => element.getBoundingClientRect().height);
      expect(height).toBeGreaterThanOrEqual(44);
    }

    await athlete.focus();
    await page.keyboard.press('Tab');
    await expect(coach).toBeFocused();
    await coach.press('Enter');
    await expect(page).toHaveURL(/\/for-trainers$/);
    await expect(page.getByRole('main').getByText('Статус: у розробці')).toBeVisible();
  });

  test('Landing footer has visible keyboard focus and touch-sized links at ' + width + 'px', async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Тема інтерфейсу' }).selectOption(theme);

    const footer = page.getByRole('contentinfo');
    const home = footer.getByRole('link', { name: 'OVRANTO', exact: true });
    const firstSection = footer
      .getByRole('navigation', { name: 'Розділи сайту' })
      .getByRole('link', { name: 'Можливості', exact: true });

    await home.focus();
    await page.keyboard.press('Tab');
    await expect(firstSection).toBeFocused();
    await expect(firstSection).toHaveCSS('outline-style', 'solid');
    await expect(firstSection).toHaveCSS('outline-width', '2px');

    const linkHeight = await firstSection.evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    expect(linkHeight).toBeGreaterThanOrEqual(44);

    await firstSection.press('Enter');
    await expect(page).toHaveURL(/\/features$/);
    await expect(page.getByRole('main')).toBeVisible();
  });
}
