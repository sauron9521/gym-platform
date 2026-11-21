import { expect, test, type Page } from '@playwright/test';

const exerciseId = '00000000-0000-4000-8000-000000000151';

async function signInEnglish(page: Page) {
  await page.goto('/login');
  await page.getByRole('combobox', { name: 'Мова' }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByLabel('Email address').fill('catalog-i18n@example.test');
  await page.getByLabel('Password').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

function mockExerciseCatalog(
  page: Page,
  options: {
    total?: number;
    pages?: number;
    failFirst?: boolean;
    taxonomyRateLimited?: boolean;
  } = {},
) {
  let listRequests = 0;
  return {
    get listRequests() {
      return listRequests;
    },
    async register() {
      await page.route('**/backend/exercises**', (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/backend/exercises/muscle-groups') {
          return route.fulfill({
            status: options.taxonomyRateLimited ? 429 : 200,
            json: options.taxonomyRateLimited
              ? { message: 'SECRET_TAXONOMY_RESPONSE' }
              : [
                  {
                    id: '00000000-0000-4000-8000-000000000201',
                    slug: 'chest',
                    name: 'Грудні м’язи',
                  },
                ],
          });
        }
        if (url.pathname === '/backend/exercises/equipment') {
          return route.fulfill({ status: 200, json: [] });
        }
        if (url.pathname !== '/backend/exercises') return route.continue();
        listRequests += 1;
        if (options.failFirst && listRequests === 1) {
          return route.fulfill({ status: 429, json: { message: 'SECRET_EXERCISE_RESPONSE' } });
        }
        const pageNumber = Number(url.searchParams.get('page') ?? 1);
        const filtered =
          !!url.searchParams.get('search') || url.searchParams.get('exerciseType') === 'CARDIO';
        return route.fulfill({
          status: 200,
          json: {
            data: filtered
              ? []
              : [
                  {
                    id: pageNumber === 1 ? exerciseId : '00000000-0000-4000-8000-000000000152',
                    name: pageNumber === 1 ? 'Жим лежачи' : 'Присідання',
                    description: 'Опис, створений користувачем',
                    source: 'GLOBAL',
                    exerciseType: 'STRENGTH',
                    isArchived: false,
                    muscleGroups: [
                      {
                        muscleGroup: {
                          id: '00000000-0000-4000-8000-000000000201',
                          name: 'Грудні м’язи',
                        },
                      },
                    ],
                  },
                ],
            meta: {
              total: filtered ? 0 : (options.total ?? 1),
              page: pageNumber,
              limit: 20,
              totalPages: filtered ? 1 : (options.pages ?? 1),
            },
          },
        });
      });
    },
  };
}

test('English catalog localizes UI, filters, types and source but preserves API names', async ({
  page,
}) => {
  await signInEnglish(page);
  const mock = mockExerciseCatalog(page);
  await mock.register();
  await page.goto('/exercises');
  await expect(page).toHaveTitle('Exercise catalog | OVRANTO');
  await expect(page.getByRole('heading', { name: 'Exercise catalog' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create custom exercise' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Exercise list' })).toBeVisible();
  await expect(page.getByText('Found: 1')).toBeVisible();
  await expect(page.getByText('Global library')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Жим лежачи' })).toBeVisible();
  await expect(page.getByText('Опис, створений користувачем')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Exercise list' }).getByText('Грудні м’язи'),
  ).toBeVisible();
  const type = page.getByLabel('Exercise type');
  await expect(type.locator('option')).toHaveText([
    'All types',
    'Strength',
    'Cardio',
    'Mobility',
    'Plyometric',
    'Other',
  ]);
  await type.selectOption('CARDIO');
  await expect(page.getByRole('heading', { name: 'No exercises found' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByText('Found: 1')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search by name' }).fill('невідома назва');
  await expect(page.getByRole('heading', { name: 'No exercises found' })).toBeVisible();
});

test('English catalog localizes 429 errors, hides server text and retries explicitly', async ({
  page,
}) => {
  await signInEnglish(page);
  const mock = mockExerciseCatalog(page);
  await mock.register();
  await page.goto('/exercises');
  await expect(page.getByText('Found: 1')).toBeVisible();
  let requests = 0;
  // Exercise filters cause a new query; avoid racing initial hydration requests.
  await page.route('**/backend/exercises?**', (route) => {
    if (new URL(route.request().url()).searchParams.get('exerciseType') !== 'CARDIO') {
      return route.fallback();
    }
    requests += 1;
    if (requests === 1) {
      return route.fulfill({ status: 429, json: { message: 'SECRET_EXERCISE_RESPONSE' } });
    }
    return route.fallback();
  });
  await page.getByLabel('Exercise type').selectOption('CARDIO');
  await expect(page.locator('main [role="alert"]')).toContainText(
    'Too many requests. Try again later.',
  );
  await expect(page.getByText('SECRET_EXERCISE_RESPONSE')).toHaveCount(0);
  expect(requests).toBe(1);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Found: 0')).toBeVisible();
  expect(requests).toBe(2);
});

test('English catalog paginates with accessible navigation and keeps names untouched', async ({
  page,
}) => {
  await signInEnglish(page);
  const mock = mockExerciseCatalog(page, { total: 21, pages: 2 });
  await mock.register();
  await page.goto('/exercises');
  const nav = page.getByRole('navigation', { name: 'Exercise pages' });
  await expect(nav).toContainText('Page 1 of 2');
  await expect(nav.getByRole('button', { name: 'Back' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Жим лежачи' })).toBeVisible();
  await nav.getByRole('button', { name: 'Next' }).click();
  await expect(nav).toContainText('Page 2 of 2');
  await expect(nav.getByRole('button', { name: 'Next' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Присідання' })).toBeVisible();
});

test('English taxonomy 429 uses safe locale-specific feedback', async ({ page }) => {
  await signInEnglish(page);
  const mock = mockExerciseCatalog(page, { taxonomyRateLimited: true });
  await mock.register();
  await page.goto('/exercises');
  await expect(page.locator('main [role="alert"]')).toContainText(
    'Too many requests for exercise filters. Try again later.',
  );
  await expect(page.getByText('SECRET_TAXONOMY_RESPONSE')).toHaveCount(0);
});
