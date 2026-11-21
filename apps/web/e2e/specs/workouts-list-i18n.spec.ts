import { expect, test, type Page } from '@playwright/test';

async function signInEnglish(page: Page) {
  await page.goto('/login');
  await page.getByRole('combobox', { name: 'Мова' }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByLabel('Email address').fill('athlete@example.test');
  await page.getByLabel('Password').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('English list uses localized filters, statuses, dates and empty states', async ({ page }) => {
  await signInEnglish(page);
  await page.goto('/workouts');
  await expect(page).toHaveTitle('My workouts | OVRANTO');
  await expect(page.getByRole('heading', { name: 'My workouts' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create workout' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Workout list' })).toBeVisible();
  await expect(page.getByText('Found: 2')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Workout list' }).getByText('Planned', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Workout list' }).getByText('Completed', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Nov.*2026/).first()).toBeVisible();
  const status = page.getByLabel('Status', { exact: true });
  await expect(status.locator('option')).toHaveText([
    'All workouts',
    'Planned',
    'In progress',
    'Completed',
    'Cancelled',
  ]);
  await status.selectOption('CANCELLED');
  await expect(page.getByRole('heading', { name: 'No workouts found' })).toBeVisible();
  await expect(page.getByText('No workouts match this status. Try another filter.')).toBeVisible();
  await status.selectOption('ALL');
  await expect(page.getByRole('region', { name: 'Workout list' })).toBeVisible();
});

test('English list rate limiting hides backend payload and permits explicit retry', async ({
  page,
}) => {
  await signInEnglish(page);
  await page.goto('/workouts');
  await expect(page.getByText('Found: 2')).toBeVisible();
  let requests = 0;
  await page.route('**/backend/workouts**', (route) => {
    requests += 1;
    if (requests === 1) {
      return route.fulfill({
        status: 429,
        json: { message: 'SECRET_DO_NOT_RENDER' },
      });
    }
    return route.continue();
  });
  await page.getByLabel('Status', { exact: true }).selectOption('CANCELLED');
  await expect(page.locator('main [role="alert"]')).toContainText(
    'Too many requests. Try again later.',
  );
  await expect(page.getByText('SECRET_DO_NOT_RENDER')).toHaveCount(0);
  expect(requests).toBe(1);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Found: 0')).toBeVisible();
  expect(requests).toBe(2);
});

test('English list pagination keeps accessible navigation and source workout titles intact', async ({
  page,
}) => {
  await signInEnglish(page);
  await page.route('**/backend/workouts**', (route) => {
    const requestUrl = new URL(route.request().url());
    const pageNumber = Number(requestUrl.searchParams.get('page') ?? 1);
    return route.fulfill({
      status: 200,
      json: {
        data: [
          {
            id:
              pageNumber === 1
                ? '00000000-0000-4000-8000-000000000101'
                : '00000000-0000-4000-8000-000000000102',
            title: pageNumber === 1 ? 'Жим лежачи' : 'Присідання',
            status: 'PLANNED',
            scheduledAt: '2026-11-15T10:00:00.000Z',
            exerciseCount: 2,
          },
        ],
        meta: { total: 11, page: pageNumber, limit: 10, totalPages: 2 },
      },
    });
  });
  await page.goto('/workouts');
  const nav = page.getByRole('navigation', { name: 'Workout pages' });
  await expect(nav).toContainText('Page 1 of 2');
  await expect(page.getByRole('heading', { name: 'Жим лежачи' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Back' })).toBeDisabled();
  await nav.getByRole('button', { name: 'Next' }).click();
  await expect(nav).toContainText('Page 2 of 2');
  await expect(page.getByRole('heading', { name: 'Присідання' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Next' })).toBeDisabled();
});
