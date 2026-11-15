import { expect, test } from '@playwright/test';
import { login, promoteTestTrainer, register, relationship, origin } from '../support/real-api-accounts';

test('real API: athlete invites trainer, trainer declines and archived contact stays private', async ({
  page: athletePage,
  browser,
}) => {
  test.setTimeout(120_000);

  // Separate spec = separate disposable NestJS rate-limit window. Only two
  // accounts are registered, with no security throttling or backend changes.
  const trainerContext = await browser.newContext();
  try {
    const trainerPage = await trainerContext.newPage();
    const athlete = await register(athletePage, 'browser-decline-athlete');
    const trainer = await register(trainerPage, 'browser-decline-trainer');
    await promoteTestTrainer(trainer.id);

    await login(athletePage, athlete.email, 'ATHLETE');
    await login(trainerPage, trainer.email, 'TRAINER');

    await athletePage.goto('/athlete/trainers');
    await athletePage.locator('#relationship-target-id').fill(trainer.id);
    await athletePage.getByRole('button', { name: 'Надіслати запрошення' }).click();
    await expect(athletePage.getByRole('button', { name: 'Скасувати запрошення' })).toBeVisible();

    const response = await athletePage.request.get('/backend/trainer-athletes?status=PENDING');
    expect(response.status()).toBe(200);
    const pending: { data: Array<{ id: string; initiatedById: string; status: string }> } =
      await response.json();
    const invitation = pending.data.find((item) => item.initiatedById === athlete.id);
    expect(invitation).toBeDefined();
    expect(invitation).toMatchObject({ status: 'PENDING', initiatedById: athlete.id });
    const id = invitation!.id;

    // An initiator must not decline their own invitation.
    const forbidden = await athletePage.request.post(
      '/backend/trainer-athletes/' + id + '/decline',
      { headers: { origin } },
    );
    expect(forbidden.status()).toBe(403);

    await trainerPage.goto('/trainer/athletes');
    await expect(trainerPage.getByRole('button', { name: 'Відхилити запрошення' })).toBeVisible();
    await trainerPage.getByRole('button', { name: 'Відхилити запрошення' }).click();
    await trainerPage
      .getByRole('form', { name: 'Підтвердження дії' })
      .getByRole('button', { name: 'Підтвердити' })
      .click();
    await expect(
      trainerPage.getByRole('button', { name: 'Відхилити запрошення' }),
    ).toHaveCount(0);

    expect(await relationship(athletePage, id)).toMatchObject({
      id,
      status: 'DECLINED',
      trainerId: trainer.id,
      athleteId: athlete.id,
      initiatedById: athlete.id,
    });
    const historical = await relationship(trainerPage, id);
    expect(historical.status).toBe('DECLINED');
    expect(JSON.stringify(historical)).not.toContain(athlete.email);
  } finally {
    await trainerContext.close();
  }
});
