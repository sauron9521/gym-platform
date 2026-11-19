import { expect, test, type Page } from '@playwright/test';

async function signInEnglish(page: Page) {
  await page.goto('/login');
  await page.getByRole('combobox', { name: /^(Мова|Language)$/ }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  // PR #249 owns the separate authentication form translations.
  await page.getByLabel('Електронна пошта').fill('athlete@example.test');
  await page.getByLabel('Пароль').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('English Dashboard status KPI and lifetime record cards show verified API data', async ({
  page,
}) => {
  const totals: Record<string, number> = {
    PLANNED: 12,
    IN_PROGRESS: 1,
    COMPLETED: 47,
  };

  await page.route('**/backend/workouts*', (route) => {
    const status = new URL(route.request().url()).searchParams.get('status');
    if (!status || !(status in totals)) return route.continue();

    const workout = {
      id: '00000000-0000-4000-8000-000000000456',
      title: 'Workout from the API',
      status,
      startedAt: '2026-11-18T09:00:00.000Z',
      scheduledAt: '2035-04-02T09:00:00.000Z',
      exerciseCount: 2,
    };
    return route.fulfill({
      status: 200,
      json: {
        data: [workout],
        meta: { page: 1, limit: 10, total: totals[status], totalPages: 1 },
      },
    });
  });
  await page.route('**/backend/workout-analytics/personal-records*', (route) =>
    route.fulfill({
      status: 200,
      json: { exerciseCount: 3, asOf: '2026-11-19T09:00:00.000Z' },
    }),
  );

  await signInEnglish(page);
  const cards = page.locator('section[aria-labelledby="dashboard-status-metrics"]');
  await expect(cards.getByRole('heading', { name: 'Workout totals by status' })).toBeVisible();
  for (const label of ['Planned', 'In progress', 'Completed']) {
    await expect(cards.getByText(label, { exact: true })).toBeVisible();
  }
  for (const count of ['12', '1', '47']) {
    await expect(cards.getByText(count, { exact: true })).toBeVisible();
  }
  await expect(cards.getByText('Personal records', { exact: true })).toBeVisible();
  await expect(cards.getByText('Exercises with a recorded lifetime best weight.')).toBeVisible();
  await expect(cards.getByText('3', { exact: true })).toBeVisible();
});

test('English personal-records rate limit gives a localized, labelled retry', async ({ page }) => {
  let requests = 0;
  await page.route('**/backend/workout-analytics/personal-records*', (route) => {
    requests += 1;
    return route.fulfill({ status: 429, json: {} });
  });

  await signInEnglish(page);
  await expect(page.getByText('Too many requests. Please try again later.')).toBeVisible();
  const beforeRetry = requests;
  await page.getByRole('button', { name: 'Retry loading personal records' }).click();
  // Background session checks may have refetched once already; test the action,
  // not an assumption about the total number of requests on initial mount.
  await expect.poll(() => requests).toBeGreaterThan(beforeRetry);
  await expect(page.getByText('Too many requests. Please try again later.')).toBeVisible();
});
