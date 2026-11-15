import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const webOrigin = 'http://127.0.0.1:3200';
const password = 'BrowserTest123!';
const exerciseName = 'Barbell Bench Press';

async function signInNewAthlete(page: Page) {
  const email = 'browser-workout-' + randomUUID() + '@example.test';
  await page.goto('/login');

  // Use a fresh account per test so the real PostgreSQL data never depends
  // on test order or a shared pre-existing athlete.
  const registration = await page.request.post('/backend/auth/register', {
    data: { email, password },
    headers: { origin: webOrigin },
  });
  expect(registration.status()).toBe(201);
  await page.context().clearCookies();

  await page.getByLabel('Електронна пошта').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function createPlannedWorkout(page: Page) {
  await signInNewAthlete(page);
  await page.goto('/workouts/new');
  await expect(page.getByRole('heading', { name: 'Створити тренування' })).toBeVisible();

  await page.locator('#exercise-search').fill(exerciseName);
  const exercise = page.getByRole('listitem').filter({
    has: page.getByText(exerciseName, { exact: true }),
  });
  await exercise.getByRole('button', { name: 'Додати', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Обрані вправи (1)' })).toBeVisible();

  const title = 'Browser workout ' + randomUUID();
  await page.locator('#workout-title').fill(title);
  await page.locator('#exercise-0-set-0-plannedReps').fill('8');
  await page.locator('#exercise-0-set-0-plannedWeightKg').fill('60.5');
  await page.getByRole('button', { name: 'Зберегти тренування' }).click();

  await expect(page).toHaveURL(/\/workouts\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  const id = new URL(page.url()).pathname.split('/').at(-1) ?? '';
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  return { id, title };
}

async function readWorkout(page: Page, id: string) {
  const response = await page.request.get('/backend/workouts/' + id);
  expect(response.status()).toBe(200);
  return response.json();
}

test('real API: browser creates a workout and persists its planned edits', async ({ page }) => {
  const { id, title } = await createPlannedWorkout(page);

  const created = await readWorkout(page, id);
  expect(created).toMatchObject({
    id,
    title,
    status: 'PLANNED',
    exercises: [{ exerciseNameSnapshot: exerciseName, sets: [{ plannedReps: 8 }] }],
  });
  expect(Number(created.exercises[0].sets[0].plannedWeightKg)).toBe(60.5);

  await page.getByRole('button', { name: 'Редагувати', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Редагування тренування' });
  const editedTitle = title + ' updated';
  await editor.getByLabel('Назва', { exact: true }).fill(editedTitle);
  await editor.getByLabel('Нотатки').fill('Updated via real browser E2E');
  await editor.getByRole('button', { name: 'Зберегти зміни' }).click();

  await expect(page.getByRole('heading', { name: editedTitle })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: editedTitle })).toBeVisible();

  expect(await readWorkout(page, id)).toMatchObject({
    id,
    title: editedTitle,
    notes: 'Updated via real browser E2E',
    status: 'PLANNED',
  });
});

test('real API: browser records and revises a workout set in PostgreSQL', async ({ page }) => {
  const { id } = await createPlannedWorkout(page);

  await page.getByRole('button', { name: 'Розпочати тренування' }).click();
  await expect(page.getByRole('button', { name: 'Записати результат' })).toBeVisible();
  await page.getByRole('button', { name: 'Записати результат' }).click();

  let form = page.getByRole('form', { name: 'Запис результатів підходу' });
  await form.getByLabel('Повторення', { exact: true }).fill('7');
  await form.getByLabel('Вага (кг)').fill('62.5');
  await form.getByRole('button', { name: 'Позначити виконаним' }).click();
  await expect(page.getByRole('button', { name: 'Змінити результат' })).toBeVisible();

  let workout = await readWorkout(page, id);
  expect(workout.status).toBe('IN_PROGRESS');
  expect(workout.exercises[0].sets[0]).toMatchObject({
    status: 'COMPLETED',
    actualReps: 7,
  });
  expect(Number(workout.exercises[0].sets[0].actualWeightKg)).toBe(62.5);

  await page.getByRole('button', { name: 'Змінити результат' }).click();
  form = page.getByRole('form', { name: 'Запис результатів підходу' });
  await form.getByLabel('Повторення', { exact: true }).fill('8');
  await form.getByLabel('Вага (кг)').fill('63.5');
  await form.getByRole('button', { name: 'Позначити виконаним' }).click();
  await expect(page.getByRole('button', { name: 'Змінити результат' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Змінити результат' })).toBeVisible();
  workout = await readWorkout(page, id);
  expect(workout.exercises[0].sets[0]).toMatchObject({
    status: 'COMPLETED',
    actualReps: 8,
  });
  expect(Number(workout.exercises[0].sets[0].actualWeightKg)).toBe(63.5);
});
