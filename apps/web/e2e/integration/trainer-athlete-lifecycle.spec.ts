import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

const origin = 'http://127.0.0.1:3200';
const password = 'BrowserTest123!';

// Resolve the database driver from the API workspace. The Web app gains no
// runtime dependency and this file only executes against a disposable test DB.
const requireApi = createRequire(new URL('../../../api/package.json', import.meta.url));
const { Client } = requireApi('pg') as {
  Client: new (options: { connectionString: string }) => {
    connect(): Promise<void>;
    query(sql: string, values: string[]): Promise<{ rowCount: number | null }>;
    end(): Promise<void>;
  };
};

function disposableDatabaseUrl(): string {
  const database = process.env.TEST_DATABASE_URL;
  if (!database || database !== process.env.DATABASE_URL) {
    throw new Error('Role fixtures require identical DATABASE_URL and TEST_DATABASE_URL');
  }
  const url = new URL(database);
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    !decodeURIComponent(url.pathname).endsWith('_test')
  ) {
    throw new Error('Role fixtures require a disposable loopback *_test database');
  }
  return database;
}

async function register(page: Page, prefix: string) {
  const email = prefix + '-' + randomUUID() + '@example.test';
  await page.goto('/login');
  const registered = await page.request.post('/backend/auth/register', {
    data: { email, password },
    headers: { origin },
  });
  expect(registered.status()).toBe(201);

  const me = await page.request.get('/backend/users/me');
  expect(me.status()).toBe(200);
  const user: { id: string; role: string } = await me.json();
  expect(user.role).toBe('ATHLETE');
  await page.context().clearCookies();
  return { email, id: user.id };
}

async function promoteTestTrainer(userId: string) {
  const client = new Client({ connectionString: disposableDatabaseUrl() });
  await client.connect();
  try {
    const result = await client.query(
      'UPDATE "users" SET "role" = $1 WHERE "id" = $2 AND "role" = $3',
      ['TRAINER', userId, 'ATHLETE'],
    );
    expect(result.rowCount).toBe(1);
  } finally {
    await client.end();
  }
}

async function login(page: Page, email: string, role: 'ATHLETE' | 'TRAINER') {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const response = await page.request.get('/backend/users/me');
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ email, role });
}

async function relationship(page: Page, id: string) {
  const result = await page.request.get('/backend/trainer-athletes/' + id);
  expect(result.status()).toBe(200);
  return result.json();
}

test('real API: invite, accept, terminate, re-invite and decline across trainer and athlete browsers', async ({
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
    await athletePage.getByRole('form', { name: 'Підтвердження дії' })
      .getByRole('button', { name: 'Підтвердити' })
      .click();
    await expect(athletePage.getByRole('button', { name: 'Завершити співпрацю' })).toBeVisible();
    expect(await relationship(athletePage, invitationId)).toMatchObject({
      status: 'ACTIVE',
      trainerId: trainer.id,
      athleteId: athlete.id,
    });

    // Both participants now see the active relationship, but only one
    // participant needs to terminate it.
    await trainerPage.reload();
    await expect(trainerPage.getByRole('button', { name: 'Завершити співпрацю' })).toBeVisible();
    await trainerPage.getByRole('button', { name: 'Завершити співпрацю' }).click();
    const ending = trainerPage.getByRole('form', { name: 'Підтвердження дії' });
    await ending.getByLabel('Причина (необов’язково)').fill('Browser lifecycle test');
    await ending.getByRole('button', { name: 'Підтвердити' }).click();
    await expect(trainerPage.getByRole('button', { name: 'Завершити співпрацю' })).toHaveCount(0);

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

    // A terminated pair can begin again. This time the athlete initiates
    // and the trainer declines through the browser.
    await athletePage.goto('/athlete/trainers');
    await athletePage.locator('#relationship-target-id').fill(trainer.id);
    await athletePage.getByRole('button', { name: 'Надіслати запрошення' }).click();
    await expect(athletePage.getByRole('button', { name: 'Скасувати запрошення' })).toBeVisible();
    const athletePendingResponse = await athletePage.request.get(
      '/backend/trainer-athletes?status=PENDING',
    );
    expect(athletePendingResponse.status()).toBe(200);
    const athletePending: { data: Array<{ id: string; initiatedById: string }> } =
      await athletePendingResponse.json();
    const secondInvitation = athletePending.data.find(
      (item) => item.initiatedById === athlete.id,
    );
    expect(secondInvitation).toBeDefined();
    expect(secondInvitation!.id).not.toBe(invitationId);

    await trainerPage.goto('/trainer/athletes');
    await trainerPage.locator('#trainer-athletes-status').selectOption('PENDING');
    await expect(trainerPage.getByRole('button', { name: 'Відхилити запрошення' })).toBeVisible();
    await trainerPage.getByRole('button', { name: 'Відхилити запрошення' }).click();
    await trainerPage.getByRole('form', { name: 'Підтвердження дії' })
      .getByRole('button', { name: 'Підтвердити' })
      .click();
    await expect(trainerPage.getByRole('button', { name: 'Відхилити запрошення' })).toHaveCount(0);
    expect(await relationship(athletePage, secondInvitation!.id)).toMatchObject({
      status: 'DECLINED',
      initiatedById: athlete.id,
    });
  } finally {
    await trainerContext.close();
  }
});
