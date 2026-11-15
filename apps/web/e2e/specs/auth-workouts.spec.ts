import { expect, test } from '@playwright/test';

const password = 'TestPassword123!';

async function signIn(page: import('@playwright/test').Page, email = 'athlete@example.test') {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Вітаємо/ })).toBeVisible();
}

test('anonymous users cannot visit dashboard, workouts or profile', async ({ page }) => {
  for (const route of ['/dashboard', '/workouts', '/profile']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Вхід у кабінет' })).toBeVisible();
  }
});

test('login rejects incorrect credentials without exposing private content', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill('athlete@example.test');
  await page.getByLabel('Пароль').fill('WrongPassword123!');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page.getByText('Невірна електронна пошта або пароль.')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

test('login form validates the email before sending credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill('invalid-email');
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page.locator('#login-email-error')).toContainText(
    'Вкажіть коректну електронну адресу',
  );
  await expect(page).toHaveURL(/\/login$/);
});

test('login persists the HttpOnly session; sign-out revokes it', async ({ page }) => {
  await signIn(page);
  await expect(page.getByText('athlete@example.test')).toBeVisible();

  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === 'gym_e2e_session');
  expect(session).toBeDefined();
  expect(session?.httpOnly).toBe(true);

  await page.getByRole('button', { name: 'Вийти' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

test('athlete can view and update the profile after server-side session verification', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Мій профіль' })).toBeVisible();
  await expect(page.getByText('Пошта: athlete@example.test')).toBeVisible();

  await page.getByLabel('Відображуване ім’я').fill('Профіль Playwright');
  await page.getByLabel('Вага (кг)').fill('82.50');
  await page.getByRole('button', { name: 'Зберегти зміни' }).click();
  await expect(page.getByRole('status')).toContainText('Профіль оновлено');

  await page.reload();
  await expect(page.getByLabel('Відображуване ім’я')).toHaveValue('Профіль Playwright');
  await expect(page.getByLabel('Вага (кг)')).toHaveValue('82.5');
});

test('workout list loads from the same-origin API and filters by status', async ({ page }) => {
  await signIn(page);
  await page.goto('/workouts');
  await expect(page.getByRole('heading', { name: 'Мої тренування' })).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: 'Жим лежачи' })).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: 'Присідання' })).toBeVisible();

  await page.getByLabel('Статус').selectOption('COMPLETED');
  await expect(page.getByRole('article').filter({ hasText: 'Присідання' })).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: 'Жим лежачи' })).toHaveCount(0);
});

test('workouts query redirects on 401 without rendering private results', async ({ page }) => {
  await signIn(page);
  await page.route('**/backend/workouts*', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/workouts');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Жим лежачи')).toHaveCount(0);
});

test('exercise catalog query redirects after a 401 without showing private results', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/backend/exercises*', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/exercises');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('exercise detail query redirects on 401 without rendering private content', async ({
  page,
}) => {
  await signIn(page);
  const id = '00000000-0000-4000-8000-000000000001';
  await page.route('**/backend/exercises/' + id, (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/exercises/' + id);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Редагувати', exact: true })).toHaveCount(0);
});

test('exercise taxonomy query redirects on 401 when creating an exercise', async ({ page }) => {
  await signIn(page);
  await page.route('**/backend/exercises/muscle-groups', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/exercises/new');
  await expect(page).toHaveURL(/\/login$/);
});

test('athlete assignment query redirects on 401 without exposing private summaries', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/backend/training-programs/assignments*', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/athlete/programs');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('region', { name: 'Призначені програми' })).toHaveCount(0);
});

test('athlete cannot view trainer-only programs even with a valid session', async ({ page }) => {
  await signIn(page);
  await page.goto('/trainer/programs');
  await expect(page.getByRole('heading', { name: 'Доступ заборонено' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Список тренувальних програм' })).toHaveCount(0);
});

test('trainer programs query redirects on 401 without showing cached program content', async ({
  page,
}) => {
  await signIn(page, 'trainer@example.test');
  await page.route('**/backend/training-programs*', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/trainer/programs');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('region', { name: 'Список тренувальних програм' })).toHaveCount(0);
});

test('trainer program details query redirects on 401 without exposing private content', async ({
  page,
}) => {
  await signIn(page, 'trainer@example.test');
  const programId = '00000000-0000-4000-8000-000000000001';
  await page.route('**/backend/training-programs/' + programId, (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/trainer/programs/' + programId);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('region', { name: 'Редагування чернетки' })).toHaveCount(0);
});

test('relationship filters use isolated cached lists without API throttling', async ({
  page,
}) => {
  await signIn(page, 'trainer@example.test');
  const requested: string[] = [];
  await page.route('**/backend/trainer-athletes*', (route) => {
    const url = new URL(route.request().url());
    requested.push(url.searchParams.get('status') ?? 'ALL');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
      }),
    });
  });

  await page.goto('/trainer/athletes');
  await expect(page.getByRole('heading', { name: 'Підопічних не знайдено' })).toBeVisible();
  await expect.poll(() => requested.at(-1)).toBe('ALL');

  const filter = page.locator('#trainer-athletes-status');
  await filter.selectOption('PENDING');
  await expect.poll(() => requested.at(-1)).toBe('PENDING');
  await filter.selectOption('ACTIVE');
  await expect.poll(() => requested.at(-1)).toBe('ACTIVE');
  await filter.selectOption('ALL');
  await expect.poll(() => requested.at(-1)).toBe('ALL');
});

test('invitation mutation keeps the form open after a 409 conflict', async ({ page }) => {
  await signIn(page, 'trainer@example.test');
  let invitations = 0;
  await page.route('**/backend/trainer-athletes*', (route) => {
    if (route.request().method() === 'POST') {
      invitations += 1;
      return route.fulfill({ status: 409, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
      }),
    });
  });

  await page.goto('/trainer/athletes');
  const invitedId = '11111111-1111-4111-8111-111111111111';
  await page.locator('#relationship-target-id').fill(invitedId);
  await page.getByRole('button', { name: 'Надіслати запрошення' }).click();
  const conflictMessage = 'Запрошення або стан співпраці вже змінився. Оновіть список.';
  await expect(page.getByText(conflictMessage)).toBeVisible();
  await expect(page.locator('#relationship-target-id')).toHaveValue(invitedId);
  await expect(page).toHaveURL(/\/trainer\/athletes$/);
  expect(invitations).toBe(1);
});

test('invitation mutation on 401 clears private UI and redirects to login', async ({ page }) => {
  await signIn(page, 'trainer@example.test');
  await page.route('**/backend/trainer-athletes*', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
      }),
    });
  });

  await page.goto('/trainer/athletes');
  const invitedId = '11111111-1111-4111-8111-111111111111';
  await page.locator('#relationship-target-id').fill(invitedId);
  await page.getByRole('button', { name: 'Надіслати запрошення' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('region', { name: 'Список підопічних' })).toHaveCount(0);
});

test('trainer relationships query redirects on 401 without showing private contacts', async ({
  page,
}) => {
  await signIn(page, 'trainer@example.test');
  await page.route('**/backend/trainer-athletes*', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/trainer/athletes');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('region', { name: 'Список підопічних' })).toHaveCount(0);
});

test('trainer can access own programs but not athlete-only pages', async ({ page }) => {
  await signIn(page, 'trainer@example.test');
  await page.goto('/trainer/programs');
  await expect(page.getByRole('heading', { name: 'Тренувальні програми' })).toBeVisible();
  await expect(page.getByText('Програм не знайдено')).toBeVisible();
  await page.goto('/athlete/programs');
  await expect(page.getByRole('heading', { name: 'Доступ заборонено' })).toBeVisible();
});
