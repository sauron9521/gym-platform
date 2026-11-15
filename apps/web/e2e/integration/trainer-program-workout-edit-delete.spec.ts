import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { login, origin, promoteTestTrainer, register } from '../support/real-api-accounts';

test('real API: edit, conflict, cancel/delete and cross-trainer isolation for workout days', async ({
  page: ownerPage,
  browser,
}) => {
  test.setTimeout(120_000);
  const otherContext = await browser.newContext();

  try {
    const otherPage = await otherContext.newPage();
    const owner = await register(ownerPage, 'browser-workout-edit-owner');
    const outsider = await register(otherPage, 'browser-workout-edit-outsider');
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
    const path =
      '/backend/training-programs/' + program.id + '/versions/' + versionId + '/workouts';

    const initialTitle = 'Ноги ' + randomUUID();
    const otherTitle = 'Руки ' + randomUUID();
    const first = await ownerPage.request.post(path, {
      headers: { origin },
      data: { weekNumber: 1, dayNumber: 1, title: initialTitle, notes: 'Старі примітки' },
    });
    expect(first.status()).toBe(201);
    const firstVersion: { workouts: Array<{ id: string; title: string }> } = await first.json();
    const workoutId = firstVersion.workouts.find((item) => item.title === initialTitle)!.id;

    const second = await ownerPage.request.post(path, {
      headers: { origin },
      data: { weekNumber: 1, dayNumber: 2, title: otherTitle },
    });
    expect(second.status()).toBe(201);

    await ownerPage.goto('/trainer/programs/' + program.id);
    await expect(ownerPage.getByRole('heading', { name: initialTitle })).toBeVisible();

    await ownerPage.getByRole('button', { name: 'Редагувати день ' + initialTitle }).click();
    const editForm = ownerPage.getByRole('form', {
      name: 'Редагування тренувального дня ' + initialTitle,
    });
    await editForm.getByLabel('Тиждень редагування').fill('3');
    await editForm.getByRole('button', { name: 'Зберегти день' }).click();
    await expect(editForm.getByText('Тиждень перевищує тривалість програми.')).toBeVisible();

    const updatedTitle = 'Оновлене тренування ' + randomUUID();
    await editForm.getByLabel('Тиждень редагування').fill('2');
    await editForm.getByLabel('День редагування').fill('1');
    await editForm.getByLabel('Нова назва тренування').fill(updatedTitle);
    await editForm.getByLabel('Примітки до дня (необов’язково)').fill('  ');

    const patchedResponse = ownerPage.waitForResponse(
      (response) =>
        response.url().includes(path + '/' + workoutId) &&
        response.request().method() === 'PATCH',
    );
    await editForm.getByRole('button', { name: 'Зберегти день' }).click();
    const patched = await patchedResponse;
    expect(patched.status()).toBe(200);
    const editedVersion = await patched.json();
    expect(editedVersion.workouts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: workoutId,
          weekNumber: 2,
          dayNumber: 1,
          title: updatedTitle,
          notes: null,
        }),
      ]),
    );
    await expect(ownerPage.getByText('Тренувальний день оновлено')).toBeVisible();
    await expect(ownerPage.getByRole('heading', { name: updatedTitle })).toBeVisible();

    await ownerPage.reload();
    await expect(ownerPage.getByRole('heading', { name: updatedTitle })).toBeVisible();
    await expect(ownerPage.getByText('Тиждень 2 · День 1')).toBeVisible();
    await expect(ownerPage.getByText('Старі примітки')).toHaveCount(0);

    await ownerPage.getByRole('button', { name: 'Редагувати день ' + updatedTitle }).click();
    const conflictForm = ownerPage.getByRole('form', {
      name: 'Редагування тренувального дня ' + updatedTitle,
    });
    await conflictForm.getByLabel('Тиждень редагування').fill('1');
    await conflictForm.getByLabel('День редагування').fill('2');
    await conflictForm.getByRole('button', { name: 'Зберегти день' }).click();
    await expect(conflictForm.getByText(/День уже зайнятий або чернетка/)).toBeVisible();
    await conflictForm.getByRole('button', { name: 'Скасувати редагування' }).click();

    await ownerPage.getByRole('button', { name: 'Видалити день ' + updatedTitle }).click();
    const confirmGroup = ownerPage.getByRole('group', {
      name: 'Підтвердження видалення ' + updatedTitle,
    });
    await expect(confirmGroup.getByText(/Дію не можна скасувати/)).toBeVisible();
    await confirmGroup.getByRole('button', { name: 'Скасувати видалення' }).click();
    await expect(ownerPage.getByRole('heading', { name: updatedTitle })).toBeVisible();

    await ownerPage.getByRole('button', { name: 'Видалити день ' + updatedTitle }).click();
    const deletedResponse = ownerPage.waitForResponse(
      (response) =>
        response.url().includes(path + '/' + workoutId) &&
        response.request().method() === 'DELETE',
    );
    await ownerPage.getByRole('button', { name: 'Підтвердити видалення' }).click();
    expect((await deletedResponse).status()).toBe(200);
    await expect(ownerPage.getByText('Тренувальний день видалено')).toBeVisible();
    await expect(ownerPage.getByRole('heading', { name: updatedTitle })).toHaveCount(0);
    await ownerPage.reload();
    await expect(ownerPage.getByRole('heading', { name: updatedTitle })).toHaveCount(0);
    await expect(ownerPage.getByRole('heading', { name: otherTitle })).toBeVisible();

    const deniedPatch = await otherPage.request.patch(path + '/' + workoutId, {
      headers: { origin },
      data: { title: 'Чуже тренування' },
    });
    expect(deniedPatch.status()).toBe(404);
    const deniedDelete = await otherPage.request.delete(path + '/' + workoutId, {
      headers: { origin },
    });
    expect(deniedDelete.status()).toBe(404);
  } finally {
    await otherContext.close();
  }
});
