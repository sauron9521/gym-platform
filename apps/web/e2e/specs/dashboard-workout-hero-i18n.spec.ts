import { expect, test, type Page } from '@playwright/test';

async function signInEnglish(page: Page) {
  await page.goto('/login');
  await page.getByRole('combobox', { name: /^(Мова|Language)$/ }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  // Auth form translations are owned by the separate PR #249.
  await page.getByLabel('Електронна пошта').fill('athlete@example.test');
  await page.getByLabel('Пароль').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

const meta = { page: 1, limit: 10, total: 1, totalPages: 1 };

test('English dashboard shows real active workout title with localized actions', async ({ page }) => {
  await page.route('**/backend/workouts*', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('status') !== 'IN_PROGRESS') return route.continue();

    return route.fulfill({
      status: 200,
      json: {
        data: [
          {
            id: '00000000-0000-4000-8000-000000000456',
            title: 'Bench press session',
            status: 'IN_PROGRESS',
            startedAt: '2026-11-18T09:00:00.000Z',
            scheduledAt: null,
            exerciseCount: 2,
          },
        ],
        meta,
      },
    });
  });

  await signInEnglish(page);
  await expect(page.getByRole('heading', { name: 'Bench press session' })).toBeVisible();
  await expect(page.getByText('Workout in progress')).toBeVisible();
  await expect(page.getByText(/Started:/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue workout' })).toHaveAttribute(
    'href',
    '/workouts/00000000-0000-4000-8000-000000000456',
  );
});

test('English dashboard shows upcoming workout after confirmed empty active list', async ({
  page,
}) => {
  await page.route('**/backend/workouts*', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('status') === 'IN_PROGRESS') {
      return route.fulfill({
        status: 200,
        json: { data: [], meta: { ...meta, total: 0 } },
      });
    }
    if (url.searchParams.get('status') !== 'PLANNED') return route.continue();

    return route.fulfill({
      status: 200,
      json: {
        data: [
          {
            id: '00000000-0000-4000-8000-000000000457',
            title: 'Leg session',
            status: 'PLANNED',
            scheduledAt: '2035-04-02T09:00:00.000Z',
            exerciseCount: 5,
          },
        ],
        meta,
      },
    });
  });

  await signInEnglish(page);
  await expect(page.getByRole('heading', { name: 'Leg session' })).toBeVisible();
  await expect(page.getByText('Next scheduled workout')).toBeVisible();
  await expect(page.getByText(/Scheduled:/)).toBeVisible();
  await expect(page.getByText('Exercises: 5')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View and start' })).toHaveAttribute(
    'href',
    '/workouts/00000000-0000-4000-8000-000000000457',
  );
});
