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

test('profile update conflict preserves the unsaved draft and only retries on click', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/profile');
  const displayName = page.getByLabel('Відображуване ім’я');
  await expect(displayName).toBeVisible();

  let conflict = true;
  let patches = 0;
  await page.route('**/backend/users/me', (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    patches += 1;
    if (conflict) {
      return route.fulfill({ status: 409, contentType: 'application/json', body: '{}' });
    }
    return route.continue();
  });

  await displayName.fill('Профіль після конфлікту');
  await page.getByRole('button', { name: 'Зберегти зміни' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Не вдалося виконати запит. Спробуйте пізніше.' }),
  ).toBeVisible();
  await expect(displayName).toHaveValue('Профіль після конфлікту');
  expect(patches).toBe(1);

  conflict = false;
  await page.getByRole('button', { name: 'Зберегти зміни' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Профіль оновлено.' })).toBeVisible();
  expect(patches).toBe(2);
});

test('profile query retries an unavailable GET only after user action', async ({ page }) => {
  await signIn(page);
  let available = false;
  await page.route('**/backend/users/me', (route) => {
    if (route.request().method() !== 'GET' || available) return route.continue();
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/profile');
  await expect(page.getByText('Не вдалося виконати запит. Спробуйте пізніше.')).toBeVisible();
  const retry = page.getByRole('button', { name: 'Спробувати знову' });
  await expect(retry).toBeVisible();
  await expect(page.getByText('Пошта: athlete@example.test')).toHaveCount(0);

  available = true;
  await retry.click();
  await expect(page.getByText('Пошта: athlete@example.test')).toBeVisible();
});

test('profile query 401 clears private data and redirects to sign-in', async ({ page }) => {
  await signIn(page);
  await page.route('**/backend/users/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Пошта: athlete@example.test')).toHaveCount(0);
});

const avatarPng = {
  name: 'avatar.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9ZkKoD4AAAAASUVORK5CYII=',
    'base64',
  ),
};

test('avatar upload and delete refresh the canonical profile once per mutation', async ({ page }) => {
  await signIn(page);
  const uploadedAvatar = '/avatars/123e4567-e89b-42d3-a456-426614174000.png';
  let avatarUrl: string | null = null;
  let profileGets = 0;
  const methods: string[] = [];

  await page.route('**/backend/users/me', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    profileGets += 1;
    const response = await route.fetch();
    const account = await response.json();
    await route.fulfill({
      response,
      json: { ...account, profile: { ...account.profile, avatarUrl } },
    });
  });

  await page.route('**/backend/users/me/avatar', (route) => {
    const request = route.request();
    methods.push(request.method());
    if (request.method() === 'POST') {
      expect(request.headers()['content-type']).toContain('multipart/form-data; boundary=');
      expect(request.postDataBuffer()?.includes(Buffer.from('avatar.png'))).toBe(true);
      avatarUrl = uploadedAvatar;
    } else if (request.method() === 'DELETE') {
      avatarUrl = null;
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/profile');
  await expect(page.getByText('Пошта: athlete@example.test')).toBeVisible();
  const initialGets = profileGets;
  await page.getByLabel('Обрати фотографію').setInputFiles(avatarPng);
  await page.getByRole('button', { name: 'Завантажити фото' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Фото профілю оновлено.' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Фото профілю' })).toHaveAttribute(
    'src',
    '/backend' + uploadedAvatar,
  );
  expect(profileGets).toBe(initialGets + 1);

  await page.getByRole('button', { name: 'Видалити фото' }).click();
  await page.getByRole('button', { name: 'Підтвердити видалення' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Фото профілю видалено.' })).toBeVisible();
  await expect(page.getByLabel('Ініціали користувача')).toBeVisible();
  expect(profileGets).toBe(initialGets + 2);
  expect(methods).toEqual(['POST', 'DELETE']);
});

test('avatar file validation and 429 preserve selected file for explicit retry', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/profile');
  await expect(page.getByLabel('Обрати фотографію')).toBeVisible();

  let requests = 0;
  await page.route('**/backend/users/me/avatar', (route) => {
    requests += 1;
    return route.fulfill({
      status: requests === 1 ? 429 : 200,
      contentType: 'application/json',
      body: '{}',
    });
  });

  await page.getByLabel('Обрати фотографію').setInputFiles({
    name: 'invalid.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg/>'),
  });
  await expect(page.getByText('Дозволено лише PNG, JPEG або WebP.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Завантажити фото' })).toBeDisabled();
  expect(requests).toBe(0);

  await page.getByLabel('Обрати фотографію').setInputFiles(avatarPng);
  await page.getByRole('button', { name: 'Завантажити фото' }).click();
  await expect(page.getByText('Забагато спроб. Спробуйте пізніше.')).toBeVisible();
  await expect(page.getByText('Обрано: avatar.png')).toBeVisible();
  expect(requests).toBe(1);

  await page.getByRole('button', { name: 'Завантажити фото' }).click();
  await expect(page.getByText('Фото профілю оновлено.')).toBeVisible();
  await expect(page.getByText('Обрано: avatar.png')).toHaveCount(0);
  expect(requests).toBe(2);
});

test('avatar mutation 401 clears the session and redirects to sign-in', async ({ page }) => {
  await signIn(page);
  await page.route('**/backend/users/me/avatar', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/profile');
  await expect(page.getByLabel('Обрати фотографію')).toBeVisible();
  await page.getByLabel('Обрати фотографію').setInputFiles(avatarPng);
  await page.getByRole('button', { name: 'Завантажити фото' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Пошта: athlete@example.test')).toHaveCount(0);
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

test('program creation mutation handles 409 and 401 safely', async ({ page }) => {
  await signIn(page, 'trainer@example.test');
  let attempts = 0;
  await page.route('**/backend/training-programs', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    attempts += 1;
    return route.fulfill({
      status: attempts === 1 ? 409 : 401,
      contentType: 'application/json',
      body: '{}',
    });
  });

  await page.goto('/trainer/programs/new');
  const title = 'Тестова чернетка без повторного створення';
  await page.getByLabel('Назва програми').fill(title);
  await page.getByRole('button', { name: 'Створити чернетку' }).click();
  const conflictMessage = 'Конфлікт під час створення програми. Оновіть список.';
  await expect(page.getByText(conflictMessage)).toBeVisible();
  await expect(page.getByLabel('Назва програми')).toHaveValue(title);
  await expect(page).toHaveURL(/\/trainer\/programs\/new$/);
  expect(attempts).toBe(1);

  await page.getByRole('button', { name: 'Створити чернетку' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Створити програму' })).toHaveCount(0);
  expect(attempts).toBe(2);
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

test('relationship filters use isolated cached lists without API throttling', async ({ page }) => {
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

test('workout details query handles 401 without revealing private workout data', async ({
  page,
}) => {
  await signIn(page);
  const id = '00000000-0000-4000-8000-000000000001';
  await page.route('**/backend/workouts/' + id, (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/workouts/' + id);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Жим лежачи' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Редагувати', exact: true })).toHaveCount(0);
});

test('workout details retry is explicit and preserves 403 privacy errors', async ({ page }) => {
  await signIn(page);
  const id = '00000000-0000-4000-8000-000000000001';
  // React development mode can issue more than one initial request. Keep
  // the server error stable until the user explicitly asks to retry.
  let responseStatus = 503;
  let requests = 0;
  await page.route('**/backend/workouts/' + id, (route) => {
    requests += 1;
    return route.fulfill({
      status: responseStatus,
      contentType: 'application/json',
      body: '{}',
    });
  });

  await page.goto('/workouts/' + id);
  await expect(
    page.getByText('Не вдалося завантажити тренування. Спробуйте ще раз.'),
  ).toBeVisible();
  const requestsBeforeRetry = requests;
  responseStatus = 403;
  await page.getByRole('button', { name: 'Спробувати ще раз' }).click();
  await expect(page.getByText('Тренування не знайдено або немає доступу.')).toBeVisible();
  expect(requests).toBeGreaterThan(requestsBeforeRetry);
  await expect(page).toHaveURL(new RegExp('/workouts/' + id + '$'));
});

test('workout edit mutation preserves unsaved values after a 409 conflict', async ({ page }) => {
  await signIn(page);
  const id = '00000000-0000-4000-8000-000000000101';
  let attempts = 0;
  await page.route('**/backend/workouts/' + id, (route) => {
    if (route.request().method() === 'PATCH') {
      attempts += 1;
      return route.fulfill({ status: 409, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id,
        title: 'Жим лежачи',
        status: 'PLANNED',
        scheduledAt: '2026-11-15T10:00:00.000Z',
        startedAt: null,
        completedAt: null,
        notes: null,
        exercises: [],
      }),
    });
  });

  await page.goto('/workouts/' + id);
  await expect(page.getByRole('button', { name: 'Редагувати', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Редагувати', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Редагування тренування' });
  const title = 'Незбережені зміни після конфлікту';
  await editor.getByLabel('Назва', { exact: true }).fill(title);
  await editor.getByRole('button', { name: 'Зберегти зміни' }).click();
  await expect(
    editor.getByText(
      'Тренування вже змінило стан або дані застаріли. Оновіть сторінку та спробуйте ще раз.',
    ),
  ).toBeVisible();
  await expect(editor.getByLabel('Назва', { exact: true })).toHaveValue(title);
  expect(attempts).toBe(1);
});

test('workout exercise picker redirects on 401 without exposing private options', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/backend/exercises*', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/workouts/new');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Додати', exact: true })).toHaveCount(0);
});
