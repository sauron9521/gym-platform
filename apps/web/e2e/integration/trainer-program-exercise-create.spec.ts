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
    await expect(form.getByRole('button', { name: 'Додати обрану вправу' })).toBeDisabled();
    let benchSearchRequests = 0;
    ownerPage.on('request', (request) => {
      const url = new URL(request.url());
      if (
        request.method() === 'GET' &&
        url.pathname === '/backend/exercises' &&
        url.searchParams.get('search') === 'bench'
      ) {
        benchSearchRequests += 1;
      }
    });

    await form.getByLabel('Пошук вправи').fill('bench');
    await expect(
      form.getByRole('button', { name: 'Обрати вправу ' + exercise!.name }),
    ).toBeVisible();
    const requestsAfterFirstSearch = benchSearchRequests;
    expect(requestsAfterFirstSearch).toBeGreaterThan(0);

    await form.getByLabel('Пошук вправи').fill('no-such-exercise-' + randomUUID());
    await expect(form.getByText('Доступних вправ не знайдено.')).toBeVisible();
    await form.getByLabel('Пошук вправи').fill('bench');
    await expect(
      form.getByRole('button', { name: 'Обрати вправу ' + exercise!.name }),
    ).toBeVisible();
    expect(benchSearchRequests).toBe(requestsAfterFirstSearch);

    await form.getByRole('button', { name: 'Обрати вправу ' + exercise!.name }).click();
    const notes = form.getByLabel('Примітки до вправи (необов’язково)');
    await notes.fill('  Контроль руху  ');

    // A server-side draft conflict must keep the selected exercise and form
    // input intact. The next explicit submit may succeed; writes never retry.
    await ownerPage.route(
      '**' + addPath,
      (route) => route.fulfill({ status: 409, contentType: 'application/json', body: '{}' }),
      { times: 1 },
    );
    const conflictResponse = ownerPage.waitForResponse(
      (response) => response.url().includes(addPath) && response.status() === 409,
    );
    await form.getByRole('button', { name: 'Додати обрану вправу' }).click();
    expect((await conflictResponse).status()).toBe(409);
    await expect(
      form.getByText('Чернетка змінилася. Оновіть сторінку і повторіть дію.'),
    ).toBeVisible();
    await expect(notes).toHaveValue('  Контроль руху  ');
    await expect(form.getByText('Обрана вправа: ' + exercise!.name)).toBeVisible();

    const savedPromise = ownerPage.waitForResponse(
      (response) => response.url().includes(addPath) && response.request().method() === 'POST',
    );
    await form.getByRole('button', { name: 'Додати обрану вправу' }).click();
    const saved = await savedPromise;
    expect(saved.status()).toBe(201);
    const updated: {
      workouts: Array<{
        id: string;
        exercises: Array<{
          exerciseId: string;
          exerciseNameSnapshot: string;
          notes: string | null;
        }>;
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

    // The picker must not keep rendering private results when its GET returns 401.
    await ownerPage.reload();
    await expect(ownerPage.getByRole('heading', { name: workoutTitle })).toBeVisible();
    await ownerPage.route('**/backend/exercises*', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
    );
    await ownerPage.getByRole('button', { name: 'Додати вправу до дня ' + workoutTitle }).click();
    await expect(ownerPage).toHaveURL(/\/login$/);
    await expect(ownerPage.getByRole('list', { name: 'Результати пошуку вправ' })).toHaveCount(0);
  } finally {
    await outsiderContext.close();
  }
});
