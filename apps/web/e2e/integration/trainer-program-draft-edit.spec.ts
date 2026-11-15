import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { login, origin, promoteTestTrainer, register } from '../support/real-api-accounts';

test('real API: owner edits draft v1 and another trainer cannot read or change it', async ({
  page: ownerPage,
  browser,
}) => {
  test.setTimeout(120_000);
  ownerPage.on('console', (message) => {
    if (message.text().includes('DRAFT_E2E_DIAGNOSTIC')) console.log(message.text());
  });

  const outsiderContext = await browser.newContext();
  try {
    const outsiderPage = await outsiderContext.newPage();
    const owner = await register(ownerPage, 'browser-draft-owner');
    const outsider = await register(outsiderPage, 'browser-draft-outsider');
    await promoteTestTrainer(owner.id);
    await promoteTestTrainer(outsider.id);

    await login(ownerPage, owner.email, 'TRAINER');
    await login(outsiderPage, outsider.email, 'TRAINER');

    const title = 'Моя чернетка ' + randomUUID();
    const created = await ownerPage.request.post('/backend/training-programs', {
      headers: { origin },
      data: { title, description: 'Початковий опис', durationWeeks: 12 },
    });
    expect(created.status()).toBe(201);
    const program: { id: string; versions: Array<{ id: string }> } = await created.json();
    const programId = program.id;
    const versionId = program.versions[0]!.id;

    await ownerPage.goto('/trainer/programs');
    await ownerPage.getByRole('link', { name: 'Деталі програми' }).click();
    await expect(ownerPage).toHaveURL(new RegExp('/trainer/programs/' + programId + '$'));
    await expect(ownerPage.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(ownerPage.getByRole('heading', { name: 'Редагувати чернетку v1' })).toBeVisible();

    await expect(ownerPage.getByLabel('Назва програми')).toHaveValue(title);
    await expect(ownerPage.getByLabel('Тривалість у тижнях (необов’язково)')).toHaveValue('12');
    await ownerPage.getByLabel('Тривалість у тижнях (необов’язково)').fill('53');
    await ownerPage.getByRole('button', { name: 'Зберегти зміни' }).click();
    await expect(ownerPage.getByText(/ціле число від 1 до 52/)).toBeVisible();

    const updatedTitle = 'Оновлена програма ' + randomUUID();
    await ownerPage.getByLabel('Назва програми').fill(updatedTitle);
    await ownerPage.getByLabel('Опис (необов’язково)').fill('');
    await ownerPage.getByLabel('Тривалість у тижнях (необов’язково)').fill('');
    const patch = ownerPage.waitForResponse(
      (response) =>
        response
          .url()
          .includes('/backend/training-programs/' + programId + '/versions/' + versionId) &&
        response.request().method() === 'PATCH',
      { timeout: 15_000 },
    );
    await ownerPage.getByRole('button', { name: 'Зберегти зміни' }).click();
    await expect(ownerPage.getByTestId('draft-debug-stage')).toHaveText('valid', {
      timeout: 3000,
    });
    const updated = await patch;
    expect(updated.status()).toBe(200);
    expect(await updated.json()).toMatchObject({
      id: versionId,
      status: 'DRAFT',
      title: updatedTitle,
      description: null,
      durationWeeks: null,
    });
    await expect(ownerPage.getByText('Зміни збережено')).toBeVisible();
    await expect(ownerPage.getByRole('heading', { name: updatedTitle, exact: true })).toBeVisible();
    await expect(ownerPage.getByRole('button', { name: 'Зберегти зміни' })).toBeDisabled();

    await ownerPage.reload();
    await expect(ownerPage.getByLabel('Назва програми')).toHaveValue(updatedTitle);
    await expect(ownerPage.getByLabel('Опис (необов’язково)')).toHaveValue('');
    await expect(ownerPage.getByLabel('Тривалість у тижнях (необов’язково)')).toHaveValue('');

    const denied = await outsiderPage.request.get('/backend/training-programs/' + programId);
    expect(denied.status()).toBe(404);
    const deniedPatch = await outsiderPage.request.patch(
      '/backend/training-programs/' + programId + '/versions/' + versionId,
      { headers: { origin }, data: { title: 'Forbidden' } },
    );
    expect(deniedPatch.status()).toBe(404);

    await outsiderPage.goto('/trainer/programs/' + programId);
    await expect(
      outsiderPage.getByRole('heading', { name: 'Не вдалося відкрити програму' }),
    ).toBeVisible();
    await expect(outsiderPage.getByText('Програму не знайдено або немає доступу.')).toBeVisible();
    await expect(outsiderPage.getByText(updatedTitle)).toHaveCount(0);

    const guestContext = await browser.newContext();
    try {
      const guest = await guestContext.newPage();
      await guest.goto('/trainer/programs/' + programId);
      await expect(guest).toHaveURL(/\/login$/);
    } finally {
      await guestContext.close();
    }
  } finally {
    await outsiderContext.close();
  }
});
