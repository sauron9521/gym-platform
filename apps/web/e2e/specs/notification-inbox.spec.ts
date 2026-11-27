import { expect, test } from '@playwright/test';
import { expectNoAxeWcagViolations } from '../support/axe-wcag';

test('Athlete inbox: localized count, cursor, read status, filtering and safe navigation', async ({
  page,
}) => {
  const stamp = '2026-11-27T08:00:00.000Z';
  const programId = '8fe38031-414f-4615-b913-f20d1c1b3478';
  const rows = [
    {
      id: programId,
      type: 'program.assigned',
      category: 'PROGRAM',
      templateKey: 'program.assigned',
      createdAt: stamp,
      readAt: null as string | null,
      target: { kind: 'PROGRAM_ASSIGNMENT', id: '4ce053de-f494-49f5-9e58-13d3918427fe' },
    },
    {
      id: 'b6943b69-40c1-4ac6-afd1-3b244f10a174',
      type: 'trainer.application.reviewed',
      category: 'ACCOUNT',
      templateKey: 'trainer.application.reviewed',
      createdAt: stamp,
      readAt: null as string | null,
    },
  ];
  let listRequests = 0;
  await page.route('**/backend/notifications**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname.endsWith('/unread-count'))
      return route.fulfill({ json: { count: rows.filter((row) => !row.readAt).length } });
    if (method === 'PATCH' && url.pathname.endsWith('/read')) {
      const item = rows.find((row) => url.pathname.includes(row.id));
      if (!item) return route.fulfill({ status: 404 });
      item.readAt = stamp;
      return route.fulfill({ json: item });
    }
    if (method === 'POST' && url.pathname.endsWith('/read-all')) {
      rows.forEach((row) => {
        row.readAt = stamp;
      });
      return route.fulfill({ status: 204 });
    }
    if (method !== 'GET') return route.fulfill({ status: 400 });
    listRequests++;
    const category = url.searchParams.get('category');
    const unread = url.searchParams.get('unread') === 'true';
    const filtered = rows.filter(
      (row) => (!category || row.category === category) && (!unread || !row.readAt),
    );
    const offset = url.searchParams.has('cursor') ? 1 : 0;
    return route.fulfill({
      json: {
        data: filtered.slice(offset, offset + 1),
        nextCursor: offset + 1 < filtered.length ? stamp + '|' + filtered[0]!.id : null,
      },
    });
  });

  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill('athlete@example.test');
  await page.getByLabel('Пароль').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const bell = page.getByRole('link', { name: 'Сповіщення (2 непрочитаних)' });
  await expect(bell).toBeVisible();
  expect(listRequests).toBe(0);
  await bell.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(
    page.getByRole('heading', { name: 'Призначено тренувальну програму' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Відкрити розділ: Призначено тренувальну програму' }),
  ).toHaveAttribute('href', '/athlete/programs');
  await page.getByRole('combobox', { name: 'Тема інтерфейсу' }).selectOption('light');
  await expect(page.locator('html')).toHaveClass(/light/);
  await expectNoAxeWcagViolations(page);
  await page.getByRole('combobox', { name: 'Тема інтерфейсу' }).selectOption('dark');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('heading', { name: 'Призначено тренувальну програму' }),
  ).toBeVisible();
  await expectNoAxeWcagViolations(page);
  await page.getByRole('button', { name: 'Завантажити ще' }).click();
  await expect(page.getByRole('heading', { name: 'Вашу заявку тренера розглянуто' })).toBeVisible();
  await page
    .getByRole('button', { name: 'Позначити прочитаним: Призначено тренувальну програму' })
    .click();
  await expect(page.getByRole('link', { name: 'Сповіщення (1 непрочитаних)' })).toBeVisible();
  await page.getByLabel('Категорія').selectOption('ACCOUNT');
  await page.getByRole('checkbox', { name: 'Лише непрочитані' }).check();
  await page.getByRole('button', { name: 'Прочитати всі' }).click();
  await expect(page.getByText('Немає сповіщень.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Сповіщення (0 непрочитаних)' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Мова' }).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await expect(page.getByText('No notifications to show.')).toBeVisible();
});
