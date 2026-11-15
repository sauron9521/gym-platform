import { expect, test } from '@playwright/test';
import { login, origin, promoteTestTrainer, register } from '../support/real-api-accounts';
import { seedTrainingProgram } from '../support/training-program-fixtures';

test('real API: published program details are read-only and PATCH is rejected', async ({
  page,
}) => {
  test.setTimeout(120_000);

  const trainer = await register(page, 'browser-published-owner');
  await promoteTestTrainer(trainer.id);
  const published = await seedTrainingProgram(trainer.id, 'Опублікована програма', 'PUBLISHED');
  await login(page, trainer.email, 'TRAINER');

  await page.goto('/trainer/programs/' + published.id);
  await expect(page.getByRole('heading', { name: published.title, exact: true })).toBeVisible();
  await expect(page.getByText('Опублікована', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Редагувати чернетку v1' })).toHaveCount(0);
  await expect(page.getByText(/Редагування недоступне/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Тренувальні дні' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Day 1' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Додати тренувальний день' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Редагувати день/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Видалити день/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Додати вправу до дня/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Додати підхід до вправи/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Редагувати підхід/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Видалити підхід/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Перемістити підхід/ })).toHaveCount(0);
  await expect(
    page.getByRole('list', { name: 'Підходи вправи Barbell Bench Press' }),
  ).toBeVisible();

  const immutable = await page.request.patch(
    '/backend/training-programs/' + published.id + '/versions/' + published.versionId,
    { headers: { origin }, data: { title: 'Should be blocked' } },
  );
  expect(immutable.status()).toBe(409);

  const immutableWorkout = await page.request.post(
    '/backend/training-programs/' + published.id + '/versions/' + published.versionId + '/workouts',
    { headers: { origin }, data: { weekNumber: 2, dayNumber: 1, title: 'Недоступний день' } },
  );
  expect(immutableWorkout.status()).toBe(409);

  const versionResponse = await page.request.get(
    '/backend/training-programs/' + published.id + '/versions/' + published.versionId,
  );
  expect(versionResponse.status()).toBe(200);
  const version: {
    workouts: Array<{
      id: string;
      exercises: Array<{ id: string; exerciseId: string; sets: Array<{ id: string }> }>;
    }>;
  } = await versionResponse.json();
  const workoutId = version.workouts[0]!.id;
  const workoutPath =
    '/backend/training-programs/' +
    published.id +
    '/versions/' +
    published.versionId +
    '/workouts/' +
    workoutId;
  const immutableEdit = await page.request.patch(workoutPath, {
    headers: { origin },
    data: { title: 'Змінений день' },
  });
  expect(immutableEdit.status()).toBe(409);
  const immutableDelete = await page.request.delete(workoutPath, {
    headers: { origin },
  });
  expect(immutableDelete.status()).toBe(409);
  const immutableExercise = await page.request.post(workoutPath + '/exercises', {
    headers: { origin },
    data: { exerciseId: version.workouts[0]!.exercises[0]!.exerciseId },
  });
  expect(immutableExercise.status()).toBe(409);
  const programExerciseId = version.workouts[0]!.exercises[0]!.id;
  const immutableSet = await page.request.post(
    workoutPath + '/exercises/' + programExerciseId + '/sets',
    { headers: { origin }, data: { setType: 'WORKING', plannedReps: 8 } },
  );
  expect(immutableSet.status()).toBe(409);
  const setId = version.workouts[0]!.exercises[0]!.sets[0]!.id;
  const setPath = workoutPath + '/exercises/' + programExerciseId + '/sets/' + setId;
  const immutableSetEdit = await page.request.patch(setPath, {
    headers: { origin },
    data: { plannedReps: 9 },
  });
  expect(immutableSetEdit.status()).toBe(409);
  const immutableSetDelete = await page.request.delete(setPath, {
    headers: { origin },
  });
  expect(immutableSetDelete.status()).toBe(409);
  const immutableReorder = await page.request.patch(
    workoutPath + '/exercises/' + programExerciseId + '/sets/reorder',
    { headers: { origin }, data: { setIds: [setId] } },
  );
  expect(immutableReorder.status()).toBe(409);
});
