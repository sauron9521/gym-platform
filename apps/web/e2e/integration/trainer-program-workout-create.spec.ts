import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { login, origin, promoteTestTrainer, register } from '../support/real-api-accounts';

test('real API: trainer creates a workout day, persists it and another trainer is denied', async ({
  page: ownerPage,
  browser,
}) => {
  test.setTimeout(120_000);
  const otherContext = await browser.newContext();

  try {
    const otherPage = await otherContext.newPage();
    const owner = await register(ownerPage, 'browser-workout-day-owner');
    const outsider = await register(otherPage, 'browser-workout-day-outsider');
    await promoteTestTrainer(owner.id);
    await promoteTestTrainer(outsider.id);

    await login(ownerPage, owner.email, 'TRAINER');
    await login(otherPage, outsider.email, 'TRAINER');

    const createProgram = await ownerPage.request.post('/backend/training-programs', {
      headers: { origin },
      data: { title: 'Програма ' + randomUUID(), durationWeeks: 2 },
    });
    expect(createProgram.status()).toBe(201);
    const program: { id: string; versions: Array<{ id: string }> } = await createProgram.json();
    const versionId = program.versions[0]!.id;

    await ownerPage.goto('/trainer/programs/' + program.id);
    await expect(ownerPage.getByRole('heading', { name: 'Тренувальні дні' })).toBeVisible();
    await expect(ownerPage.getByText('Тренувальних днів поки немає.')).toBeVisible();
    await expect(
      ownerPage.getByRole('heading', { name: 'Додати тренувальний день' }),
    ).toBeVisible();

    // The client rejects weeks beyond the program's declared duration.
    await ownerPage.getByLabel('Тиждень', { exact: true }).fill('3');
    await ownerPage.getByLabel('Назва тренування').fill('День ніг');
    await ownerPage.getByRole('button', { name: 'Додати день' }).click();
    await expect(ownerPage.getByText('Тиждень перевищує тривалість програми.')).toBeVisible();

    const title = 'Силове тренування ' + randomUUID();
    await ownerPage.getByLabel('Тиждень', { exact: true }).fill('1');
    await ownerPage.getByLabel('День', { exact: true }).fill('2');
    await ownerPage.getByLabel('Назва тренування').fill(title);
    await ownerPage.getByLabel('Примітки (необов’язково)').fill('  Базові вправи  ');
    await ownerPage.getByLabel('Примітки (необов’язково)').blur();
    await expect(ownerPage.getByRole('button', { name: 'Додати день' })).toBeEnabled();

    const savedResponse = ownerPage.waitForResponse(
      (response) =>
        response
          .url()
          .includes(
            '/backend/training-programs/' + program.id + '/versions/' + versionId + '/workouts',
          ) && response.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await ownerPage.getByRole('button', { name: 'Додати день' }).click();
    const saved = await savedResponse;
    expect(saved.status()).toBe(201);
    const version = await saved.json();
    expect(version).toMatchObject({ id: versionId, status: 'DRAFT' });
    expect(version.workouts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          weekNumber: 1,
          dayNumber: 2,
          title,
          notes: 'Базові вправи',
        }),
      ]),
    );
    await expect(ownerPage.getByText('Тренувальний день додано')).toBeVisible();
    await expect(ownerPage.getByRole('heading', { name: title })).toBeVisible();
    await expect(ownerPage.getByText('Тиждень 1 · День 2')).toBeVisible();

    // Revisit the version through the program list; the cached workouts must
    // agree with the version returned by the successful create operation.
    await ownerPage.getByRole('link', { name: /До тренувальних програм/ }).click();
    await expect(ownerPage).toHaveURL(/\/trainer\/programs$/);
    await ownerPage.getByRole('link', { name: 'Деталі програми' }).click();
    await expect(ownerPage).toHaveURL(/\/trainer\/programs\/[0-9a-f-]{36}$/);
    await expect(ownerPage.getByRole('heading', { name: title })).toBeVisible();

    await ownerPage.reload();
    await expect(ownerPage.getByRole('heading', { name: title })).toBeVisible();
    await expect(ownerPage.getByText('Базові вправи')).toBeVisible();

    const deniedRead = await otherPage.request.get('/backend/training-programs/' + program.id);
    expect(deniedRead.status()).toBe(404);
    const deniedCreate = await otherPage.request.post(
      '/backend/training-programs/' + program.id + '/versions/' + versionId + '/workouts',
      {
        headers: { origin },
        data: { weekNumber: 2, dayNumber: 1, title: 'Чуже тренування' },
      },
    );
    expect(deniedCreate.status()).toBe(404);

    // A rejected version fetch must redirect before any private workout is shown.
    await ownerPage.route(
      '**/backend/training-programs/' + program.id + '/versions/' + versionId,
      (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
    );
    await ownerPage.reload();
    await expect(ownerPage).toHaveURL(/\/login$/);
    await expect(ownerPage.getByRole('heading', { name: title })).toHaveCount(0);
  } finally {
    await otherContext.close();
  }
});
