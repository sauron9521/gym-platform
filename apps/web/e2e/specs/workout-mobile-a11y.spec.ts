import { expect, test, type Page } from '@playwright/test';

const workoutId = '00000000-0000-4000-8000-000000000301';
const exerciseId = '00000000-0000-4000-8000-000000000302';
const otherExerciseId = '00000000-0000-4000-8000-000000000303';
const firstSetId = '00000000-0000-4000-8000-000000000304';
const secondSetId = '00000000-0000-4000-8000-000000000305';
const thirdSetId = '00000000-0000-4000-8000-000000000306';

function makeSet(id: string, setNumber: number) {
  return {
    id,
    setNumber,
    setType: 'WORKING',
    status: 'PENDING',
    plannedReps: 8,
    plannedWeightKg: '60.50',
    plannedDurationSeconds: null,
    plannedDistanceMeters: null,
    actualReps: null as number | null,
    actualWeightKg: null as string | number | null,
    actualDurationSeconds: null,
    actualDistanceMeters: null,
    restSeconds: null,
    targetRpe: null,
    targetRir: null,
    rpe: null,
    rir: null,
    notes: null,
    updatedAt: '2026-11-19T07:00:00.000Z',
  };
}

function makeWorkout() {
  return {
    id: workoutId,
    title: 'Мобільне тренування',
    status: 'IN_PROGRESS',
    scheduledAt: null,
    startedAt: '2026-11-19T07:00:00.000Z',
    completedAt: null,
    notes: null,
    exercises: [
      {
        id: exerciseId,
        exerciseNameSnapshot: 'Жим лежачи',
        notes: null,
        sets: [makeSet(firstSetId, 1), makeSet(secondSetId, 2)],
      },
      {
        id: otherExerciseId,
        exerciseNameSnapshot: 'Присідання',
        notes: null,
        sets: [makeSet(thirdSetId, 1)],
      },
    ],
  };
}

async function openActiveWorkout(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill('athlete@example.test');
  await page.getByLabel('Пароль').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const workout = makeWorkout();
  await page.route('**/backend/workouts/' + workoutId, (route) =>
    route.fulfill({ status: 200, json: workout }),
  );

  await page.goto('/workouts/' + workoutId);
  await expect(page.getByRole('heading', { name: 'Мобільне тренування' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Прогрес тренування' })).toBeVisible();
  return workout;
}

async function expectNoHorizontalPageOverflow(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

for (const width of [320, 360, 390]) {
  test(`active workout is usable without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await openActiveWorkout(page);

    await expectNoHorizontalPageOverflow(page);
    const navigation = page.getByRole('navigation', { name: 'Перехід між вправами' });
    await expect(navigation.getByRole('link')).toHaveCount(2);
    await expect(page.getByRole('progressbar', { name: 'Прогрес тренування' })).toBeVisible();

    await page.getByRole('button', { name: 'Записати результат' }).first().click();
    const form = page.getByRole('form', { name: 'Запис результатів підходу' });
    await expect(form).toBeVisible();
    await expect(form.getByRole('textbox', { name: 'Повторення' })).toBeFocused();
    await expect(form.getByRole('textbox', { name: 'Вага (кг)' })).toBeVisible();
    await expectNoHorizontalPageOverflow(page);

    const targets = await form.locator('button').evaluateAll((buttons) =>
      buttons.map((button) => {
        const { x, right, height } = button.getBoundingClientRect();
        return { x, right, height };
      }),
    );
    expect(targets.length).toBeGreaterThanOrEqual(5);
    for (const target of targets) {
      expect(target.x).toBeGreaterThanOrEqual(-1);
      expect(target.right).toBeLessThanOrEqual(width + 1);
      expect(target.height).toBeGreaterThanOrEqual(44);
    }

    const reps = form.getByRole('textbox', { name: 'Повторення' });
    await page.keyboard.press('Tab');
    await expect(form.getByRole('textbox', { name: 'Вага (кг)' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(reps).toBeFocused();

    await form.getByRole('button', { name: 'Закрити' }).click();
    await expect(page.locator('#workout-set-edit-' + firstSetId)).toBeFocused();
    await expectNoHorizontalPageOverflow(page);
  });
}

test('collapsed invalid notes open and focus an associated error at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 812 });
  await openActiveWorkout(page);
  await page.getByRole('button', { name: 'Записати результат' }).first().click();

  const form = page.getByRole('form', { name: 'Запис результатів підходу' });
  const advanced = form.locator('details');
  const summary = advanced.locator('summary');
  await summary.click();
  const notes = form.getByRole('textbox', { name: 'Нотатки' });
  await notes.fill('x'.repeat(5001));
  await summary.click();
  await expect(advanced).not.toHaveAttribute('open', '');

  await form.getByRole('button', { name: 'Позначити виконаним' }).click();
  await expect(advanced).toHaveAttribute('open', '');
  await expect(notes).toHaveAttribute('aria-invalid', 'true');
  const errorId = await notes.getAttribute('aria-describedby');
  expect(errorId).toBe('workout-set-' + firstSetId + '-notes-error');
  await expect(page.locator('#' + errorId)).toHaveAttribute('role', 'alert');
  await expect(notes).toBeFocused();
  await expectNoHorizontalPageOverflow(page);
});

test('saving on a narrow viewport advances only after API acknowledgement', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 812 });
  const workout = await openActiveWorkout(page);
  let submissions = 0;

  await page.route('**/backend/workouts/' + workoutId + '/sets/*', async (route) => {
    submissions += 1;
    const body = route.request().postDataJSON() as {
      status: 'COMPLETED';
      actualReps: number | null;
      actualWeightKg: number | null;
    };
    const saved = workout.exercises[0]!.sets[0]!;
    saved.status = body.status;
    saved.actualReps = body.actualReps;
    saved.actualWeightKg = body.actualWeightKg;
    saved.updatedAt = '2026-11-19T07:01:00.000Z';
    await route.fulfill({ status: 200, json: saved });
  });

  await page.getByRole('button', { name: 'Записати результат' }).first().click();
  const form = page.getByRole('form', { name: 'Запис результатів підходу' });
  await form.getByRole('button', { name: 'Підставити план' }).click();
  await form.getByRole('button', { name: 'Зберегти й наступний' }).click();

  await expect(page.locator('#workout-set-' + secondSetId)).toContainText('Робочий');
  const nextEditor = page.getByRole('form', { name: 'Запис результатів підходу' });
  await expect(nextEditor).toBeVisible();
  await expect(nextEditor.getByRole('textbox', { name: 'Повторення' })).toBeFocused();
  await expect(page.getByText('Опрацьовано 1 із 3')).toBeVisible();
  expect(submissions).toBe(1);
  await expectNoHorizontalPageOverflow(page);
});
