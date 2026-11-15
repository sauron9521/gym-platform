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
});
