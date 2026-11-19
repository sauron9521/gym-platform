import { expect, test, type Page } from '@playwright/test';

async function signInEnglish(page: Page) {
  await page.goto('/login');
  await page.getByRole('combobox', { name: /^(Мова|Language)$/ }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  // Login copy is owned by the separate Auth i18n PR #249.
  await page.getByLabel('Електронна пошта').fill('athlete@example.test');
  await page.getByLabel('Пароль').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('English chart shows locale-formatted API data and switches 30d to 7d without stale values', async ({
  page,
}) => {
  await page.route('**/backend/workout-analytics/summary*', (route) => {
    const range = new URL(route.request().url()).searchParams.get('range');
    return route.fulfill({
      status: 200,
      json: {
        asOf: '2026-11-19T09:00:00.000Z',
        workoutCount: 4,
        activeDays: 3,
        daily: [{ date: '2026-11-17', strengthVolumeKg: range === '7d' ? 750 : 1500 }],
      },
    });
  });

  await signInEnglish(page);
  const chart = page.locator('section[aria-labelledby="dashboard-volume-heading"]');
  await expect(chart.getByRole('heading', { name: 'Workout progress' })).toBeVisible();
  await expect(chart.getByRole('group', { name: 'Chart period' })).toBeVisible();
  await expect(
    chart.getByRole('img', { name: /Strength-training volume chart for 30 days/ }),
  ).toBeVisible();

  await chart.getByText('View exact daily values').click();
  const daily = chart.getByRole('list', { name: 'Daily training volume values' });
  await expect(daily.getByText('1,500 kg')).toBeVisible();
  await expect(daily.locator('time[datetime="2026-11-17"]')).toContainText('Nov');
  await expect(chart.getByText(/Workouts: 4. Active days: 3. API data as of/)).toBeVisible();

  await chart.getByRole('button', { name: '7 days' }).click();
  await expect(
    chart.getByRole('img', { name: /Strength-training volume chart for 7 days/ }),
  ).toBeVisible();
  // Range changes unmount the previous details element while the new query
  // loads, so expand the fresh daily-value panel before checking the values.
  await chart.getByText('View exact daily values').click();
  await expect(daily.getByText('750 kg')).toBeVisible();
  await expect(daily.getByText('1,500 kg')).toHaveCount(0);
  await expect(chart.getByRole('button', { name: '7 days' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('English chart 429 keeps private values hidden and offers a localized retry', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/backend/workout-analytics/summary*', (route) => {
    requests += 1;
    return route.fulfill({ status: 429, json: {} });
  });

  await signInEnglish(page);
  const chart = page.locator('section[aria-labelledby="dashboard-volume-heading"]');
  await expect(chart.getByRole('alert')).toContainText('Too many requests');
  await expect(chart.getByRole('img')).toHaveCount(0);

  const beforeRetry = requests;
  await chart.getByRole('button', { name: 'Retry loading chart' }).click();
  await expect.poll(() => requests).toBeGreaterThan(beforeRetry);
  await expect(chart.getByRole('alert')).toContainText('Too many requests');
});
