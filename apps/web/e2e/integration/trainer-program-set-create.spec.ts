import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { login, origin, promoteTestTrainer, register } from '../support/real-api-accounts';

test('real API: trainer adds validated sets to a program exercise; values persist and outsiders are denied', async ({
  page: ownerPage,
  browser,
}) => {
  test.setTimeout(120_000);
  const outsiderContext = await browser.newContext();

  try {
    const outsiderPage = await outsiderContext.newPage();
    const owner = await register(ownerPage, 'browser-program-set-owner');
    const outsider = await register(outsiderPage, 'browser-program-set-outsider');
    await promoteTestTrainer(owner.id);
    await promoteTestTrainer(outsider.id);
    await login(ownerPage, owner.email, 'TRAINER');
    await login(outsiderPage, outsider.email, 'TRAINER');

    const catalog = await ownerPage.request.get('/backend/exercises?search=bench&limit=20');
    expect(catalog.status()).toBe(200);
    const list: { data: Array<{ id: string; name: string; slug: string | null }> } =
      await catalog.json();
    const exercise = list.data.find((item) => item.slug === 'barbell-bench-press');
    expect(exercise).toBeDefined();

    const created = await ownerPage.request.post('/backend/training-programs', {
      headers: { origin },
      data: { title: 'Підходи ' + randomUUID(), durationWeeks: 2 },
    });
    expect(created.status()).toBe(201);
    const program: { id: string; versions: Array<{ id: string }> } = await created.json();
    const versionId = program.versions[0]!.id;
    const workoutTitle = 'День жиму ' + randomUUID();
    const workoutPath =
      '/backend/training-programs/' + program.id + '/versions/' + versionId + '/workouts';
    const day = await ownerPage.request.post(workoutPath, {
      headers: { origin },
      data: { weekNumber: 1, dayNumber: 1, title: workoutTitle },
    });
    expect(day.status()).toBe(201);
    const firstVersion: { workouts: Array<{ id: string }> } = await day.json();
    const workoutId = firstVersion.workouts[0]!.id;
    const addExercise = await ownerPage.request.post(
      workoutPath + '/' + workoutId + '/exercises',
      { headers: { origin }, data: { exerciseId: exercise!.id } },
    );
    expect(addExercise.status()).toBe(201);
    const withExercise: {
      workouts: Array<{ id: string; exercises: Array<{ id: string }> }>;
    } = await addExercise.json();
    const programExerciseId = withExercise.workouts.find((w) => w.id === workoutId)!.exercises[0]!.id;
    const addSetPath =
      workoutPath + '/' + workoutId + '/exercises/' + programExerciseId + '/sets';

    await ownerPage.goto('/trainer/programs/' + program.id);
    await expect(ownerPage.getByRole('heading', { name: workoutTitle })).toBeVisible();
    await ownerPage.getByRole('button', {
      name: 'Додати підхід до вправи ' + exercise!.name,
    }).click();
    const form = ownerPage.getByRole('form', {
      name: 'Додавання підходу до вправи ' + exercise!.name,
    });

    // Invalid repetitions are rejected client-side, without creating a set.
    await form.getByLabel('Повторення').fill('0');
    await form.getByRole('button', { name: 'Зберегти підхід' }).click();
    await expect(form.getByRole('alert')).toContainText('Повторення');

    await form.getByLabel('Повторення').fill('8');
    await form.getByLabel('Вага (кг)').fill('62.50');
    await form.getByLabel('Відпочинок (с)').fill('90');
    await form.getByLabel('Цільовий RPE').fill('8.5');
    await form.getByLabel('Цільовий RIR').fill('2');
    await form.getByLabel('Примітки до підходу (необов’язково)').fill('  Контроль темпу  ');

    const savedPromise = ownerPage.waitForResponse(
      (response) => response.url().includes(addSetPath) && response.request().method() === 'POST',
    );
    await form.getByRole('button', { name: 'Зберегти підхід' }).click();
    const saved = await savedPromise;
    expect(saved.status()).toBe(201);
    const version: {
      workouts: Array<{
        exercises: Array<{
          id: string;
          sets: Array<{
            setNumber: number;
            setType: string;
            plannedReps: number | null;
            plannedWeightKg: string | null;
            restSeconds: number | null;
            targetRpe: string | null;
            targetRir: number | null;
            notes: string | null;
          }>;
        }>;
      }>;
    } = await saved.json();
    const firstSet = version.workouts[0]!.exercises.find((e) => e.id === programExerciseId)!.sets[0]!;
    expect(firstSet).toMatchObject({
      setNumber: 1,
      setType: 'WORKING',
      plannedReps: 8,
      restSeconds: 90,
      targetRir: 2,
      notes: 'Контроль темпу',
    });
    expect(Number(firstSet.plannedWeightKg)).toBe(62.5);
    expect(Number(firstSet.targetRpe)).toBe(8.5);

    await expect(ownerPage.getByText('Підхід додано до вправи')).toBeVisible();
    const setList = ownerPage.getByRole('list', { name: 'Підходи вправи ' + exercise!.name });
    await expect(setList.getByText(/Підхід 1:/)).toBeVisible();
    await expect(setList.getByText('Контроль темпу')).toBeVisible();

    await ownerPage.reload();
    await expect(
      ownerPage.getByRole('list', { name: 'Підходи вправи ' + exercise!.name })
        .getByText(/Підхід 1:/),
    ).toBeVisible();

    await ownerPage.getByRole('button', {
      name: 'Додати підхід до вправи ' + exercise!.name,
    }).click();
    const nextForm = ownerPage.getByRole('form', {
      name: 'Додавання підходу до вправи ' + exercise!.name,
    });
    await nextForm.getByLabel('Тип підходу').selectOption('WARMUP');
    await nextForm.getByLabel('Повторення').fill('12');
    const secondPromise = ownerPage.waitForResponse(
      (response) => response.url().includes(addSetPath) && response.request().method() === 'POST',
    );
    await nextForm.getByRole('button', { name: 'Зберегти підхід' }).click();
    const second = await secondPromise;
    expect(second.status()).toBe(201);
    const afterSecond = await second.json();
    const sets = afterSecond.workouts[0].exercises[0].sets;
    expect(sets.map((set: { setNumber: number }) => set.setNumber)).toEqual([1, 2]);
    await expect(
      ownerPage.getByRole('list', { name: 'Підходи вправи ' + exercise!.name })
        .getByText(/Підхід 2:/),
    ).toBeVisible();

    const denied = await outsiderPage.request.post(addSetPath, {
      headers: { origin },
      data: { setType: 'WORKING', plannedReps: 5 },
    });
    expect(denied.status()).toBe(404);
  } finally {
    await outsiderContext.close();
  }
});
