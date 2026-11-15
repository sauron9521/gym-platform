import { expect, test } from '@playwright/test';
import {
  login,
  promoteTestTrainer,
  register,
  relationship,
  origin,
} from '../support/real-api-accounts';

test('real API: trainer invitation, acceptance, termination and privacy', async ({
  page: athletePage,
  browser,
}) => {
  test.setTimeout(180_000);

  // The API rate-limits registrations by loopback IP. Exactly two fresh
  // accounts are registered in this spec; each Playwright spec runs against
  // its own newly started NestJS instance.
  const trainerContext = await browser.newContext();
  try {
    const trainerPage = await trainerContext.newPage();
    const athlete = await register(athletePage, 'browser-relationship-athlete');
    const trainer = await register(trainerPage, 'browser-relationship-trainer');
    await promoteTestTrainer(trainer.id);

    await login(athletePage, athlete.email, 'ATHLETE');
    await login(trainerPage, trainer.email, 'TRAINER');

    // Each role must be denied the other's protected dashboard.
    await athletePage.goto('/trainer/athletes');
    await expect(athletePage.getByRole('heading', { name: 'Доступ заборонено' })).toBeVisible();
    await trainerPage.goto('/athlete/trainers');
    await expect(trainerPage.getByRole('heading', { name: 'Доступ заборонено' })).toBeVisible();

    // Trainer invites the athlete through the real Web form.
    await trainerPage.goto('/trainer/athletes');
    await trainerPage.locator('#relationship-target-id').fill(athlete.id);
    await trainerPage.getByRole('button', { name: 'Надіслати запрошення' }).click();
    await expect(trainerPage.getByRole('button', { name: 'Скасувати запрошення' })).toBeVisible();

    // Query keys must isolate status filters and restore PENDING after visiting ACTIVE.
    await trainerPage.locator('#trainer-athletes-status').selectOption('ACTIVE');
    await expect(trainerPage.getByRole('heading', { name: 'Підопічних не знайдено' })).toBeVisible();
    await trainerPage.locator('#trainer-athletes-status').selectOption('PENDING');
    await expect(trainerPage.getByRole('button', { name: 'Скасувати запрошення' })).toBeVisible();
    await trainerPage.locator('#trainer-athletes-status').selectOption('ALL');
    await expect(trainerPage.getByRole('button', { name: 'Скасувати запрошення' })).toBeVisible();

    const pendingResponse = await trainerPage.request.get(
      '/backend/trainer-athletes?status=PENDING',
    );
    expect(pendingResponse.status()).toBe(200);
    const pending: { data: Array<{ id: string; initiatedById: string; status: string }> } =
      await pendingResponse.json();
    const invitation = pending.data.find((item) => item.initiatedById === trainer.id);
    expect(invitation).toBeDefined();
    const invitationId = invitation!.id;
    expect(invitation).toMatchObject({ status: 'PENDING', initiatedById: trainer.id });

    // The initiator must not be able to accept their own invitation.
    const selfAcceptance = await trainerPage.request.post(
      '/backend/trainer-athletes/' + invitationId + '/accept',
      { headers: { origin } },
    );
    expect(selfAcceptance.status()).toBe(403);

    await athletePage.goto('/athlete/trainers');
    await expect(athletePage.getByRole('button', { name: 'Прийняти запрошення' })).toBeVisible();
    await athletePage.getByRole('button', { name: 'Прийняти запрошення' }).click();
    await athletePage
      .getByRole('form', { name: 'Підтвердження дії' })
      .getByRole('button', { name: 'Підтвердити' })
      .click();
    await expect(athletePage.getByRole('button', { name: 'Завершити співпрацю' })).toBeVisible();
    expect(await relationship(athletePage, invitationId)).toMatchObject({
      status: 'ACTIVE',
      trainerId: trainer.id,
      athleteId: athlete.id,
    });

    // Successful acceptance invalidates PENDING while ACTIVE gains the relationship.
    await athletePage.locator('#trainer-athletes-status').selectOption('ACTIVE');
    await expect(athletePage.getByRole('button', { name: 'Завершити співпрацю' })).toBeVisible();
    await athletePage.locator('#trainer-athletes-status').selectOption('PENDING');
    await expect(athletePage.getByRole('heading', { name: 'Підопічних не знайдено' })).toBeVisible();

    // Both participants now see the active relationship, but only one
    // participant needs to terminate it.
    await trainerPage.reload();
    await expect(trainerPage.getByRole('button', { name: 'Завершити співпрацю' })).toBeVisible();
    await trainerPage.getByRole('button', { name: 'Завершити співпрацю' }).click();
    const ending = trainerPage.getByRole('form', { name: 'Підтвердження дії' });
    await ending.getByLabel('Причина (необов’язково)').fill('Browser lifecycle test');
    await ending.getByRole('button', { name: 'Підтвердити' }).click();
    await expect(trainerPage.getByRole('button', { name: 'Завершити співпрацю' })).toHaveCount(0);

    // Termination must invalidate both the old ACTIVE and historical status caches.
    await trainerPage.locator('#trainer-athletes-status').selectOption('ACTIVE');
    await expect(trainerPage.getByRole('heading', { name: 'Підопічних не знайдено' })).toBeVisible();
    await trainerPage.locator('#trainer-athletes-status').selectOption('TERMINATED');
    await expect(trainerPage.getByText('Користувач (контакти приховані)')).toBeVisible();

    const terminated = await relationship(trainerPage, invitationId);
    expect(terminated).toMatchObject({
      id: invitationId,
      status: 'TERMINATED',
      endedById: trainer.id,
      endReason: 'Browser lifecycle test',
    });
    // A former trainer cannot recover the athlete's contact details from
    // historical relationship data.
    expect(JSON.stringify(terminated)).not.toContain(athlete.email);
    expect(await relationship(athletePage, invitationId)).toMatchObject({
      status: 'TERMINATED',
    });
  } finally {
    await trainerContext.close();
  }
});
