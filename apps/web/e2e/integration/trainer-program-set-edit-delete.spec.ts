import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { login, origin, promoteTestTrainer, register } from '../support/real-api-accounts';

test('real API: edit and clear set targets, cancel/delete sets, and enforce trainer ownership', async ({
  page: ownerPage,
  browser,
}) => {
  test.setTimeout(120_000);
  const otherContext = await browser.newContext();
  try {
    const otherPage = await otherContext.newPage();
    const owner = await register(ownerPage, 'browser-program-set-edit-owner');
    const outsider = await register(otherPage, 'browser-program-set-edit-other');
    await promoteTestTrainer(owner.id);
    await promoteTestTrainer(outsider.id);
    await login(ownerPage, owner.email, 'TRAINER');
    await login(otherPage, outsider.email, 'TRAINER');

    const catalog = await ownerPage.request.get('/backend/exercises?search=bench&limit=20');
    expect(catalog.status()).toBe(200);
    const data: { data: Array<{ id: string; name: string; slug: string | null }> } =
      await catalog.json();
    const exercise = data.data.find((entry) => entry.slug === 'barbell-bench-press');
    expect(exercise).toBeDefined();

    const created = await ownerPage.request.post('/backend/training-programs', {
      headers: { origin },
      data: { title: 'Редагування підходів ' + randomUUID(), durationWeeks: 2 },
    });
    expect(created.status()).toBe(201);
    const program: { id: string; versions: Array<{ id: string }> } = await created.json();
    const versionId = program.versions[0]!.id;
    const workoutTitle = 'План жиму ' + randomUUID();
    const workoutsPath =
      '/backend/training-programs/' + program.id + '/versions/' + versionId + '/workouts';
    const day = await ownerPage.request.post(workoutsPath, {
      headers: { origin },
      data: { weekNumber: 1, dayNumber: 1, title: workoutTitle },
    });
    expect(day.status()).toBe(201);
    const version: { workouts: Array<{ id: string }> } = await day.json();
    const workoutId = version.workouts[0]!.id;
    const withExercise = await ownerPage.request.post(workoutsPath + '/' + workoutId + '/exercises', {
      headers: { origin },
      data: { exerciseId: exercise!.id },
    });
    expect(withExercise.status()).toBe(201);
    const populated: { workouts: Array<{ exercises: Array<{ id: string }> }> } =
      await withExercise.json();
    const programExerciseId = populated.workouts[0]!.exercises[0]!.id;
    const setsPath = workoutsPath + '/' + workoutId + '/exercises/' + programExerciseId + '/sets';

    const first = await ownerPage.request.post(setsPath, {
      headers: { origin },
      data: {
        setType: 'WORKING',
        plannedReps: 10,
        plannedWeightKg: 60,
        restSeconds: 90,
        targetRpe: 8,
        notes: 'Старі примітки',
      },
    });
    expect(first.status()).toBe(201);
    const firstVersion: {
      workouts: Array<{ exercises: Array<{ sets: Array<{ id: string; setNumber: number }> }> }>;
    } = await first.json();
    const firstSetId = firstVersion.workouts[0]!.exercises[0]!.sets[0]!.id;

    const second = await ownerPage.request.post(setsPath, {
      headers: { origin },
      data: { setType: 'WARMUP', plannedReps: 6 },
    });
    expect(second.status()).toBe(201);
    const secondVersion: {
      workouts: Array<{ exercises: Array<{ sets: Array<{ id: string; setNumber: number }> }> }>;
    } = await second.json();
    const secondSetId = secondVersion.workouts[0]!.exercises[0]!.sets.find(
      (set) => set.setNumber === 2,
    )!.id;

    await ownerPage.goto('/trainer/programs/' + program.id);
    const setList = ownerPage.getByRole('list', { name: 'Підходи вправи ' + exercise!.name });
    await expect(setList.getByText(/Підхід 1:/)).toBeVisible();
    await expect(setList.getByText(/Підхід 2:/)).toBeVisible();

    await ownerPage
      .getByRole('button', { name: 'Редагувати підхід 1 вправи ' + exercise!.name })
      .click();
    const form = ownerPage.getByRole('form', {
      name: 'Редагування підходу 1 вправи ' + exercise!.name,
    });
    await expect(form.getByLabel('Повторення')).toHaveValue('10');
    await form.getByLabel('Повторення').fill('0');
    await form.getByRole('button', { name: 'Зберегти зміни' }).click();
    await expect(form.getByRole('alert')).toContainText('Повторення');

    await form.getByLabel('Повторення').fill('8');
    await form.getByLabel('Вага (кг)').fill('70.25');
    await form.getByLabel('Відпочинок (с)').fill('');
    await form.getByLabel('Цільовий RPE').fill('8.5');
    await form.getByLabel('Примітки до підходу (необов’язково)').fill('  ');
    await form.getByLabel('Тип підходу').selectOption('DROP_SET');

    const updatedResponse = ownerPage.waitForResponse(
      (response) =>
        response.url().includes(setsPath + '/' + firstSetId) &&
        response.request().method() === 'PATCH',
    );
    await form.getByRole('button', { name: 'Зберегти зміни' }).click();
    const patched = await updatedResponse;
    expect(patched.status()).toBe(200);
    expect(patched.request().postDataJSON()).toMatchObject({
      setType: 'DROP_SET',
      plannedReps: 8,
      plannedWeightKg: 70.25,
      restSeconds: null,
      targetRpe: 8.5,
      notes: null,
    });
    const edited: {
      workouts: Array<{
        exercises: Array<{
          sets: Array<{
            id: string;
            setType: string;
            plannedReps: number | null;
            plannedWeightKg: string | null;
            restSeconds: number | null;
            targetRpe: string | null;
            notes: string | null;
          }>;
        }>;
      }>;
    } = await patched.json();
    const updatedSet = edited.workouts[0]!.exercises[0]!.sets.find(
      (set) => set.id === firstSetId,
    )!;
    expect(updatedSet).toMatchObject({
      setType: 'DROP_SET',
      plannedReps: 8,
      restSeconds: null,
      notes: null,
    });
    expect(Number(updatedSet.plannedWeightKg)).toBe(70.25);
    expect(Number(updatedSet.targetRpe)).toBe(8.5);

    await expect(ownerPage.getByText('Підхід оновлено')).toBeVisible();
    await expect(setList.getByText(/Підхід 1:.*70.25 кг/)).toBeVisible();
    await expect(ownerPage.getByText('Старі примітки')).toHaveCount(0);
    await ownerPage.reload();
    await expect(
      ownerPage.getByRole('list', { name: 'Підходи вправи ' + exercise!.name })
        .getByText(/Підхід 1:.*70.25 кг/),
    ).toBeVisible();

    await ownerPage
      .getByRole('button', { name: 'Видалити підхід 2 вправи ' + exercise!.name })
      .click();
    const confirmGroup = ownerPage.getByRole('group', {
      name: 'Підтвердження видалення підходу 2 вправи ' + exercise!.name,
    });
    await expect(confirmGroup.getByText(/Дію не можна скасувати/)).toBeVisible();
    await confirmGroup.getByRole('button', { name: 'Скасувати видалення підходу' }).click();
    await expect(ownerPage.getByText(/Підхід 2:/)).toBeVisible();

    await ownerPage
      .getByRole('button', { name: 'Видалити підхід 2 вправи ' + exercise!.name })
      .click();
    const deletedResponse = ownerPage.waitForResponse(
      (response) =>
        response.url().includes(setsPath + '/' + secondSetId) &&
        response.request().method() === 'DELETE',
    );
    await ownerPage.getByRole('button', { name: 'Підтвердити видалення підходу' }).click();
    expect((await deletedResponse).status()).toBe(200);
    await expect(ownerPage.getByText('Підхід видалено')).toBeVisible();
    await expect(ownerPage.getByText(/Підхід 2:/)).toHaveCount(0);
    await ownerPage.reload();
    await expect(ownerPage.getByText(/Підхід 2:/)).toHaveCount(0);
    await expect(ownerPage.getByText(/Підхід 1:/)).toBeVisible();

    const forbiddenUpdate = await otherPage.request.patch(setsPath + '/' + firstSetId, {
      headers: { origin },
      data: { plannedReps: 5 },
    });
    expect(forbiddenUpdate.status()).toBe(404);
    const forbiddenDelete = await otherPage.request.delete(setsPath + '/' + firstSetId, {
      headers: { origin },
    });
    expect(forbiddenDelete.status()).toBe(404);
  } finally {
    await otherContext.close();
  }
});
