import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { login, promoteTestTrainer, register } from '../support/real-api-accounts';
import { seedTrainingProgram } from '../support/training-program-fixtures';

test('real API: trainer sees only owned programs and can filter published versions', async ({
  page: ownerPage,
  browser,
}) => {
  test.setTimeout(120_000);

  const otherContext = await browser.newContext();
  try {
    const otherPage = await otherContext.newPage();
    const owner = await register(ownerPage, 'program-owner');
    const outsider = await register(otherPage, 'program-other-trainer');
    await promoteTestTrainer(owner.id);
    await promoteTestTrainer(outsider.id);

    const draft = await seedTrainingProgram(owner.id, 'Draft ' + randomUUID(), 'DRAFT');
    const published = await seedTrainingProgram(owner.id, 'Published ' + randomUUID(), 'PUBLISHED');

    await login(ownerPage, owner.email, 'TRAINER');
    await login(otherPage, outsider.email, 'TRAINER');

    await ownerPage.goto('/trainer/programs');
    await expect(ownerPage.getByRole('heading', { name: 'Тренувальні програми' })).toBeVisible();
    await expect(ownerPage.getByRole('heading', { name: draft.title })).toBeVisible();
    await expect(ownerPage.getByRole('heading', { name: published.title })).toBeVisible();
    await expect(ownerPage.getByText('Усього програм: 2')).toBeVisible();

    await ownerPage.locator('#training-program-status').selectOption('PUBLISHED');
    await expect(ownerPage.getByRole('heading', { name: published.title })).toBeVisible();
    await expect(ownerPage.getByRole('heading', { name: draft.title })).toHaveCount(0);
    await ownerPage.getByText('Переглянути версії').click();
    await expect(ownerPage.getByText('v1 — ' + published.title)).toBeVisible();

    await ownerPage.locator('#training-program-status').selectOption('DRAFT');
    await expect(ownerPage.getByRole('heading', { name: draft.title })).toBeVisible();
    await expect(ownerPage.getByRole('heading', { name: published.title })).toHaveCount(0);

    // Returning to ALL must read the correctly scoped query, not the DRAFT cache.
    await ownerPage.locator('#training-program-status').selectOption('ALL');
    await expect(ownerPage.getByRole('heading', { name: published.title })).toBeVisible();
    await expect(ownerPage.getByRole('heading', { name: draft.title })).toBeVisible();

    await otherPage.goto('/trainer/programs');
    await expect(otherPage.getByRole('heading', { name: 'Програм не знайдено' })).toBeVisible();
    await expect(otherPage.getByRole('heading', { name: draft.title })).toHaveCount(0);
    await expect(otherPage.getByRole('heading', { name: published.title })).toHaveCount(0);

    // Backend ownership is authoritative even if a foreign program UUID leaks.
    const denied = await otherPage.request.get('/backend/training-programs/' + published.id);
    expect(denied.status()).toBe(404);
    const owned = await ownerPage.request.get('/backend/training-programs/' + published.id);
    expect(owned.status()).toBe(200);
    expect(await owned.json()).toMatchObject({ id: published.id, trainerId: owner.id });
  } finally {
    await otherContext.close();
  }
});
