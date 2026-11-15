import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { login, origin, promoteTestTrainer, register } from '../support/real-api-accounts';

test('real API: trainer adds a catalogue exercise to a draft workout and another trainer is denied', async ({
  page: ownerPage,
  browser,
}) => {
  test.setTimeout(120_000);
  const outsiderContext = await browser.newContext();

  try {
    const outsiderPage = await outsiderContext.newPage();
    const owner = await register(ownerPage, 'browser-program-exercise-owner');
    const outsider = await register(outsiderPage, 'browser-program-exercise-outsider');
    await promoteTestTrainer(owner.id);
    await promoteTestTrainer(outsider.id);
    await login(ownerPage, owner.email, 'TRAINER');
    await login(outsiderPage, outsider.email, 'TRAINER');

    const catalog = await ownerPage.request.get('/backend/exercises?search=bench&limit=20');
    expect(catalog.status()).toBe(200);
    const available: { data: Array<{ id: string; name: string; slug: string | null }> } =
      await catalog.json();
    const exercise = available.data.find((item) => item.slug === 'barbell-bench-press');
    expect(exercise).toBeDefined();

    const created = await ownerPage.request.post('/backend/training-programs', {
      headers: { origin },
      data: { title: 'План ' + randomUUID(), durationWeeks: 2 },
    });
    expect(created.status()).toBe(201);
    const program: { id: string; versions: Array<{ id: string }> } = await created.json();
    const versionId = program.versions[0]!.id;
    const workoutTitle = 'День сили ' + randomUUID();
    const workoutPath =
      '/backend/training-programs/' + program.id + '/versions/' + versionId + '/workouts';

    const dayCreated = await ownerPage.request.post(workoutPath, {
      headers: { origin },
      data: { weekNumber: 1, dayNumber: 1, title: workoutTitle },
    });
    expect(dayCreated.status()).toBe(201);
    const version: { workouts: Array<{ id: string; title: string }> } = await dayCreated.json();
    const workoutId = version.workouts.find((item) => item.title === workoutTitle)!.id;
    const addPath = workoutPath + '/' + workoutId + '/exercises';

    await ownerPage.goto('/trainer/programs/' + program.id);
    await expect(ownerPage.getByRole('heading', { name: workoutTitle })).toBeVisible();
    await ownerPage.getByRole('button', { name: 'Додати вправу до дня ' + workoutTitle }).click();

    const form = ownerPage.getByRole('form', {
      name: 'Додавання вправи до тренування ' + workoutTitle,
    });
    await form.getByRole('button', { name: 'Додати обрану вправу' }).isDisabled();
    await form.getByLabel('Пошук вправи').fill('bench');
    await expect(form.getByRole('button', { name: 'Обрати вправу ' + exercise!.name })).toBeVisible();
    await form.getByRole('button', { name: 'Обрати вправу ' + exercise!.name }).click();
    await form.getByLabel('Примітки до вправи (необов’язково)').fill('  Контроль руху  ');

    const savedPromise = ownerPage.waitForResponse(
      (response) => response.url().includes(addPath) && response.request().method() === 'POST',
    );
    await form.getByRole('button', { name: 'Додати обрану вправу' }).click();
    const saved = await savedPromise;
    expect(saved.status()).toBe(201);
    const updated: {
      workouts: Array<{
        id: string;
        exercises: Array<{ exerciseId: string; exerciseNameSnapshot: string; notes: string | null }>;
      }>;
    } = await saved.json();
    const exercises = updated.workouts.find((item) => item.id === workoutId)!.exercises;
    expect(exercises).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exerciseId: exercise!.id,
          exerciseNameSnapshot: exercise!.name,
          notes: 'Контроль руху',
        }),
      ]),
    );

    await expect(ownerPage.getByText('Вправу додано до тренувального дня')).toBeVisible();
    const dayList = ownerPage.getByRole('list', { name: 'Вправи дня ' + workoutTitle });
    await expect(dayList.getByText(exercise!.name, { exact: true })).toBeVisible();
    await expect(dayList.getByText('Контроль руху')).toBeVisible();

    await ownerPage.reload();
    const persisted = ownerPage.getByRole('list', { name: 'Вправи дня ' + workoutTitle });
    await expect(persisted.getByText(exercise!.name, { exact: true })).toBeVisible();

    await ownerPage.getByRole('button', { name: 'Додати вправу до дня ' + workoutTitle }).click();
    const reopened = ownerPage.getByRole('form', {
      name: 'Додавання вправи до тренування ' + workoutTitle,
    });
    await reopened.getByLabel('Пошук вправи').fill('bench');
    await expect(
      reopened.getByRole('button', { name: 'Обрати вправу ' + exercise!.name }),
    ).toBeDisabled();
    await reopened.getByRole('button', { name: 'Скасувати додавання' }).click();

    const denied = await outsiderPage.request.post(addPath, {
      headers: { origin },
      data: { exerciseId: exercise!.id },
    });
    expect(denied.status()).toBe(404);
  } finally {
    await outsiderContext.close();
  }
});
