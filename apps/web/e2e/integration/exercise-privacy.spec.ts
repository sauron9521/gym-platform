import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const webOrigin = 'http://127.0.0.1:3200';
const password = 'BrowserTest123!';

async function signInNewAthlete(page: Page) {
  const email = 'browser-exercise-' + randomUUID() + '@example.test';
  await page.goto('/login');

  // Every test account is unique and lives only in the disposable *_test DB.
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

  const me = await page.request.get('/backend/users/me');
  expect(me.status()).toBe(200);
  const user: { id: string } = await me.json();
  return user.id;
}

async function createPrivateExercise(page: Page) {
  const ownerId = await signInNewAthlete(page);
  const name = 'Browser private exercise ' + randomUUID();

  await page.goto('/exercises/new');
  await expect(page.getByRole('heading', { name: 'Створити власну вправу' })).toBeVisible();
  await page.locator('#create-exercise-name').fill(name);
  await page.locator('#create-exercise-description').fill('Private exercise regression fixture');
  await page.locator('#create-exercise-muscle').selectOption('chest');
  await page.getByRole('button', { name: 'Додати групу' }).click();
  await page.getByLabel('Barbell', { exact: true }).check();
  await page.locator('#create-exercise-visibility').selectOption('PRIVATE');

  await page.getByRole('button', { name: 'Створити вправу' }).click();
  await expect(page).toHaveURL(/\/exercises\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name })).toBeVisible();

  const id = new URL(page.url()).pathname.split('/').at(-1) ?? '';
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  return { id, name, ownerId };
}

async function readExercise(page: Page, id: string) {
  const response = await page.request.get('/backend/exercises/' + id);
  expect(response.status()).toBe(200);
  return response.json();
}

test('real API: athlete creates and edits a private exercise with persisted taxonomy', async ({
  page,
}) => {
  const { id, name, ownerId } = await createPrivateExercise(page);

  const created = await readExercise(page, id);
  expect(created).toMatchObject({
    id,
    name,
    createdById: ownerId,
    source: 'ATHLETE_CUSTOM',
    visibility: 'PRIVATE',
    isArchived: false,
    muscleGroups: [{ role: 'PRIMARY', muscleGroup: { slug: 'chest' } }],
    equipment: [{ equipment: { slug: 'barbell' } }],
  });

  await page.getByRole('button', { name: 'Редагувати', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Редагування вправи' });
  const updatedName = name + ' updated';
  await editor.getByLabel('Назва', { exact: true }).fill(updatedName);
  await editor.getByLabel('Опис').fill('Updated by real browser E2E');

  // Conflict responses keep the draft intact; PATCH is only retried on submit.
  await page.route(
    '**/backend/exercises/' + id,
    (route) => route.fulfill({ status: 409, contentType: 'application/json', body: '{}' }),
    { times: 1 },
  );
  const conflict = page.waitForResponse(
    (response) => response.url().endsWith('/exercises/' + id) && response.status() === 409,
  );
  await editor.getByRole('button', { name: 'Зберегти зміни' }).click();
  expect((await conflict).status()).toBe(409);
  await expect(
    editor.getByText('Вправа вже змінилася. Оновіть дані й спробуйте ще раз.'),
  ).toBeVisible();
  await expect(editor.getByLabel('Назва', { exact: true })).toHaveValue(updatedName);
  await expect(editor.getByLabel('Опис')).toHaveValue('Updated by real browser E2E');

  await editor.getByRole('button', { name: 'Зберегти зміни' }).click();

  await expect(page.getByRole('heading', { name: updatedName })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: updatedName })).toBeVisible();

  expect(await readExercise(page, id)).toMatchObject({
    id,
    name: updatedName,
    description: 'Updated by real browser E2E',
    createdById: ownerId,
    visibility: 'PRIVATE',
    muscleGroups: [{ role: 'PRIMARY', muscleGroup: { slug: 'chest' } }],
    equipment: [{ equipment: { slug: 'barbell' } }],
  });

  // Query cache must reflect a successful edit, and filtering must use the real API.
  await page.goto('/exercises');
  await page.getByLabel('Пошук за назвою').fill(updatedName);
  await expect(page.getByRole('article').filter({ hasText: updatedName })).toBeVisible();
  await page.getByLabel('Пошук за назвою').fill('no-such-exercise-' + randomUUID());
  await expect(page.getByRole('article').filter({ hasText: updatedName })).toHaveCount(0);
  await expect(page.getByText('Вправ не знайдено')).toBeVisible();

  // Reuse this owner and exercise to avoid consuming a fourth registration
  // within the disposable API's shared rate-limit window.
  await page.goto('/exercises/' + id);
  await page.getByRole('button', { name: 'Архівувати', exact: true }).click();
  const confirmation = page.getByRole('group', { name: 'Підтвердження архівування' });
  await expect(confirmation).toBeVisible();

  const archivedResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/exercises/' + id) &&
      response.request().method() === 'DELETE',
  );
  await confirmation.getByRole('button', { name: 'Так, архівувати' }).click();
  expect((await archivedResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/exercises$/);
  expect((await page.request.get('/backend/exercises/' + id)).status()).toBe(404);

  await page.getByLabel('Пошук за назвою').fill(updatedName);
  await expect(page.getByRole('article').filter({ hasText: updatedName })).toHaveCount(0);
  await expect(page.getByText('Вправ не знайдено')).toBeVisible();
});

test('real API: another athlete and a guest cannot read or mutate private exercises', async ({
  page,
  browser,
}) => {
  const { id, name, ownerId } = await createPrivateExercise(page);

  const guest = await browser.newContext();
  const other = await browser.newContext();
  try {
    const guestPage = await guest.newPage();
    await guestPage.goto('/login');
    expect((await guestPage.request.get('/backend/exercises/' + id)).status()).toBe(404);

    const otherPage = await other.newPage();
    const otherId = await signInNewAthlete(otherPage);
    expect(otherId).not.toBe(ownerId);

    const hidden = await otherPage.request.get('/backend/exercises/' + id);
    expect(hidden.status()).toBe(404);
    const list = await otherPage.request.get(
      '/backend/exercises?search=' + encodeURIComponent(name),
    );
    expect(list.status()).toBe(200);
    expect((await list.json()).data).toEqual([]);

    await otherPage.goto('/exercises/' + id);
    await expect(
      otherPage.getByRole('alert').filter({ hasText: 'Вправу не знайдено або немає доступу.' }),
    ).toBeVisible();
    await expect(otherPage.getByRole('button', { name: 'Редагувати' })).toHaveCount(0);

    // A foreign ID must be indistinguishable from a nonexistent ID for writes.
    const change = await otherPage.request.patch('/backend/exercises/' + id, {
      data: { name: 'Unauthorized edit' },
      headers: { origin: webOrigin },
    });
    expect(change.status()).toBe(404);
    const archive = await otherPage.request.delete('/backend/exercises/' + id, {
      headers: { origin: webOrigin },
    });
    expect(archive.status()).toBe(404);

    expect(await readExercise(page, id)).toMatchObject({
      id,
      name,
      createdById: ownerId,
      visibility: 'PRIVATE',
      isArchived: false,
    });
  } finally {
    await other.close();
    await guest.close();
  }
});
