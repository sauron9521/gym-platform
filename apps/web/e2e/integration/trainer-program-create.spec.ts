import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { login, origin, promoteTestTrainer, register } from '../support/real-api-accounts';

test('real API: trainer creates a draft program, athlete and guest cannot create it', async ({
  page: trainerPage,
  browser,
}) => {
  test.setTimeout(120_000);

  const athleteContext = await browser.newContext();
  try {
    const athletePage = await athleteContext.newPage();
    const trainer = await register(trainerPage, 'browser-program-create-trainer');
    const athlete = await register(athletePage, 'browser-program-create-athlete');
    await promoteTestTrainer(trainer.id);

    await login(trainerPage, trainer.email, 'TRAINER');
    await login(athletePage, athlete.email, 'ATHLETE');

    await athletePage.goto('/trainer/programs/new');
    await expect(athletePage.getByRole('heading', { name: 'Доступ заборонено' })).toBeVisible();
    const denied = await athletePage.request.post('/backend/training-programs', {
      headers: { origin },
      data: { title: 'Unauthorized draft' },
    });
    expect(denied.status()).toBe(403);

    const guestContext = await browser.newContext();
    try {
      const guestPage = await guestContext.newPage();
      await guestPage.goto('/trainer/programs/new');
      await expect(guestPage).toHaveURL(/\/login$/);
    } finally {
      await guestContext.close();
    }

    await trainerPage.goto('/trainer/programs');
    await trainerPage.getByRole('link', { name: 'Створити програму' }).click();
    await expect(trainerPage).toHaveURL(/\/trainer\/programs\/new$/);
    await expect(trainerPage.getByRole('heading', { name: 'Створити програму' })).toBeVisible();

    // Invalid fields are rejected before making a POST request.
    await trainerPage.getByLabel('Назва програми').fill('A');
    await trainerPage.getByRole('button', { name: 'Створити чернетку' }).click();
    await expect(trainerPage.getByText('Мінімум 2 символи.')).toBeVisible();

    const title = 'Мій тренувальний план ' + randomUUID();
    await trainerPage.getByLabel('Назва програми').fill(title);
    await trainerPage.getByLabel('Тривалість у тижнях (необов’язково)').fill('53');
    await trainerPage.getByRole('button', { name: 'Створити чернетку' }).click();
    await expect(trainerPage.getByText(/ціле число від 1 до 52/)).toBeVisible();

    await trainerPage.getByLabel('Тривалість у тижнях (необов’язково)').fill('8');
    await trainerPage.getByLabel('Опис (необов’язково)').fill('  План для реального E2E  ');

    const createdPromise = trainerPage.waitForResponse(
      (response) =>
        response.url().endsWith('/backend/training-programs') &&
        response.request().method() === 'POST',
    );
    await trainerPage.getByRole('button', { name: 'Створити чернетку' }).click();

    const created = await createdPromise;
    expect(created.status()).toBe(201);
    const program = await created.json();
    expect(program).toMatchObject({
      trainerId: trainer.id,
      status: 'DRAFT',
      versions: [{ title, version: 1, status: 'DRAFT', durationWeeks: 8 }],
    });
    await expect(trainerPage).toHaveURL(/\/trainer\/programs$/);
    await expect(trainerPage.getByRole('heading', { name: title })).toBeVisible();
    await expect(trainerPage.getByText('Усього програм: 1')).toBeVisible();
    await trainerPage.getByText('Переглянути версії').click();
    await expect(trainerPage.getByText('v1 — ' + title)).toBeVisible();
  } finally {
    await athleteContext.close();
  }
});
