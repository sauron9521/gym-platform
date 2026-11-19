import { expect, test, type Page } from '@playwright/test';

import { expectNoAxeWcagViolations } from '../support/axe-wcag';

const workoutId = '00000000-0000-4000-8000-000000000321';
const firstSetId = '00000000-0000-4000-8000-000000000322';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill('athlete@example.test');
  await page.getByLabel('Пароль').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /^(Вітаємо|Welcome,)/ })).toBeVisible();
}

async function openActiveWorkout(page: Page) {
  await signIn(page);

  await page.route('**/backend/workouts/' + workoutId, (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: workoutId,
        title: 'Доступне тренування',
        status: 'IN_PROGRESS',
        scheduledAt: null,
        startedAt: '2026-11-19T07:00:00.000Z',
        completedAt: null,
        notes: null,
        exercises: [
          {
            id: '00000000-0000-4000-8000-000000000323',
            exerciseNameSnapshot: 'Жим лежачи',
            notes: null,
            sets: [
              {
                id: firstSetId,
                setNumber: 1,
                setType: 'WORKING',
                status: 'PENDING',
                plannedReps: 8,
                plannedWeightKg: '60.50',
                plannedDurationSeconds: null,
                plannedDistanceMeters: null,
                actualReps: null,
                actualWeightKg: null,
                actualDurationSeconds: null,
                actualDistanceMeters: null,
                restSeconds: null,
                rpe: null,
                rir: null,
                notes: null,
                updatedAt: '2026-11-19T07:00:00.000Z',
              },
            ],
          },
        ],
      },
    }),
  );

  await page.goto('/workouts/' + workoutId);
  await expect(page.getByRole('heading', { name: 'Доступне тренування' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Прогрес тренування' })).toBeVisible();
}

for (const width of [320, 1280]) {
  test(`public sign-in has no detectable WCAG 2.2 A/AA violations at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/login');
    await expect(page.getByLabel('Електронна пошта')).toBeVisible();
    await expectNoAxeWcagViolations(page);
  });
}

test('athlete dashboard has no detectable WCAG 2.2 A/AA violations at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 812 });
  await signIn(page);
  await expectNoAxeWcagViolations(page);
});

test('workout list has no detectable WCAG 2.2 A/AA violations at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 812 });
  await signIn(page);
  await page.goto('/workouts');
  await expect(page.getByRole('heading', { name: 'Мої тренування' })).toBeVisible();
  await expectNoAxeWcagViolations(page);
});

for (const width of [320, 1280]) {
  test(`active workout details have no detectable WCAG 2.2 A/AA violations at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await openActiveWorkout(page);
    await expectNoAxeWcagViolations(page);
  });
}

test('open workout set editor meets automated WCAG 2.2 A/AA at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await openActiveWorkout(page);
  await page.getByRole('button', { name: 'Записати результат' }).click();

  const form = page.getByRole('form', { name: 'Запис результатів підходу' });
  await expect(form.getByRole('textbox', { name: 'Повторення' })).toBeFocused();
  await expectNoAxeWcagViolations(page);

  await form.locator('summary').click();
  await expect(form.getByRole('textbox', { name: 'Нотатки' })).toBeVisible();
  await expectNoAxeWcagViolations(page);
});

test('invalid advanced notes state meets automated WCAG 2.2 A/AA at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 812 });
  await openActiveWorkout(page);
  await page.getByRole('button', { name: 'Записати результат' }).click();

  const form = page.getByRole('form', { name: 'Запис результатів підходу' });
  const details = form.locator('details');
  await details.locator('summary').click();
  await form.getByRole('textbox', { name: 'Нотатки' }).fill('x'.repeat(5001));
  await details.locator('summary').click();
  await form.getByRole('button', { name: 'Позначити виконаним' }).click();

  const notes = form.getByRole('textbox', { name: 'Нотатки' });
  await expect(notes).toHaveAttribute('aria-invalid', 'true');
  await expect(notes).toBeFocused();
  await expect(form.getByRole('alert')).toBeVisible();
  await expectNoAxeWcagViolations(page);
});

// Reuse the existing axe helper while exercising real user preference controls.
for (const locale of ['uk', 'en'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${locale}/${theme} dashboard accessibility`, async ({ page }) => {
      const width = locale === 'en' ? 1280 : 390;
      await page.setViewportSize({ width, height: 812 });
      await signIn(page);
      const header = page.getByTestId('athlete-shell-header');
      await header.getByRole('combobox').first().selectOption(theme);
      await header.getByRole('combobox').nth(1).selectOption(locale);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      await expect(header.getByRole('combobox').first()).toHaveValue(theme);
      await expect(header.getByRole('combobox').nth(1)).toHaveValue(locale);
      await expectNoAxeWcagViolations(page);
    });
  }
}

test('system appearance follows OS colors', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await signIn(page);
  const theme = page.getByTestId('athlete-shell-header').getByRole('combobox').first();
  await theme.selectOption('system');
  await page.reload();
  await expect(theme).toHaveValue('system');
  await expect(page.locator('html')).not.toHaveClass(/(?:light|dark)/);
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await expectNoAxeWcagViolations(page);
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(light).not.toBe(dark);
  await expectNoAxeWcagViolations(page);
});
