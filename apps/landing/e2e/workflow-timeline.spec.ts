import { expect, test } from '@playwright/test';

for (const { width, theme } of [
  { width: 320, theme: 'light' },
  { width: 390, theme: 'dark' },
  { width: 1280, theme: 'light' },
] as const) {
  test(`Workflow remains an ordered, connected sequence at ${width}px / ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
    await page.goto('/');

    const workflow = page.locator('section[aria-labelledby="workflow"]');
    const steps = workflow.locator('ol.landing-workflow-steps > li');
    await expect(steps).toHaveCount(3);

    const desktop = workflow.locator('[data-slot="landing-workflow-desktop-connector"]');
    const mobile = workflow.locator('[data-slot="landing-workflow-mobile-connector"]');
    await expect(desktop).toHaveCount(2);
    await expect(mobile).toHaveCount(2);

    for (let index = 0; index < 3; index += 1) {
      const step = steps.nth(index);
      await step.scrollIntoViewIfNeeded();
      await expect(step.getByText(`0${index + 1}`, { exact: true })).toBeVisible();
      await expect(step.getByRole('heading', { level: 3 })).toBeVisible();
    }

    await expect(desktop.first()).toHaveAttribute('aria-hidden', 'true');
    await expect(mobile.first()).toHaveAttribute('aria-hidden', 'true');
    if (width >= 768) {
      await expect(desktop.first()).toBeVisible();
      await expect(mobile.first()).toBeHidden();
    } else {
      await expect(desktop.first()).toBeHidden();
      await expect(mobile.first()).toBeVisible();
    }

    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    expect(fits).toBe(true);
  });
}

test('Workflow connectors respond to desktop hover with reduced motion off', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');

  const card = page.locator('.landing-milestone-card').first();
  const arrow = card.locator('[data-slot="landing-workflow-desktop-connector"] > span');
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await expect(arrow).toHaveCSS('translate', /4px/);
});

test('Workflow remains static when reduced motion is requested', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');

  const card = page.locator('.landing-milestone-card').first();
  const arrow = card.locator('[data-slot="landing-workflow-desktop-connector"] > span');
  await card.scrollIntoViewIfNeeded();
  await card.hover();

  await expect(card).toHaveCSS('transform', 'none');
  await expect(arrow).toHaveCSS('translate', 'none');
  await expect(arrow).toHaveCSS('transition-duration', '0s');
  await expect(page.locator('.landing-workflow-steps > li')).toHaveCount(3);
});
