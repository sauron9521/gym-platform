import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { login, register, withDisposableDatabase } from '../support/real-api-accounts';

test('real API: browser route guards follow live trainer and athlete grants on the same session', async ({
  page,
}) => {
  test.setTimeout(180_000);

  const athlete = await register(page, 'browser-live-capabilities');
  await login(page, athlete.email, 'ATHLETE');

  const adminId = randomUUID();
  const profileId = randomUUID();

  async function grants() {
    const response = await page.request.get('/backend/users/me/capabilities');
    expect(response.status()).toBe(200);
    return response.json();
  }

  async function trainerAllowed() {
    await page.goto('/trainer/programs');
    await expect(page.getByRole('heading', { name: 'Тренувальні програми' })).toBeVisible();
    await page.goto('/trainer/athletes');
    await expect(page.getByRole('heading', { name: 'Мої підопічні' })).toBeVisible();
    await page.goto('/trainer/programs/new');
    await expect(page.getByRole('heading', { name: 'Створити програму' })).toBeVisible();
  }

  async function trainerDenied() {
    for (const path of ['/trainer/programs', '/trainer/athletes', '/trainer/programs/new']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'Доступ заборонено' })).toBeVisible();
    }
  }

  async function athleteAllowed() {
    await page.goto('/athlete/programs');
    await expect(page.getByRole('heading', { name: 'Мої програми' })).toBeVisible();
    await page.goto('/athlete/trainers');
    await expect(page.getByRole('heading', { name: 'Мої тренери' })).toBeVisible();
  }

  try {
    expect(await grants()).toEqual({ athlete: true, trainer: false, admin: false });
    await trainerDenied();
    await athleteAllowed();

    // This reviewer is a fixture in a disposable test database; the browser
    // never gets an elevated session and cannot create a TrainerProfile itself.
    await withDisposableDatabase(async (db) => {
      await db.query(
        'INSERT INTO "users" ("id", "email", "password_hash", "role", "updated_at") VALUES ($1, $2, $3, $4, NOW())',
        [adminId, 'route-reviewer-' + adminId + '@example.test', 'no-usable-password', 'ADMIN'],
      );
      await db.query(
        'INSERT INTO "trainer_profiles" ("id", "user_id", "is_active", "approved_at", "approved_by_id", "updated_at") VALUES ($1, $2, TRUE, NOW(), $3, NOW())',
        [profileId, athlete.id, adminId],
      );
    });

    expect(await grants()).toEqual({ athlete: true, trainer: true, admin: false });
    await trainerAllowed();
    await athleteAllowed();

    // Revocation is immediately visible to Next's uncached server guard.
    await withDisposableDatabase(async (db) => {
      await db.query(
        'UPDATE "trainer_profiles" SET "is_active" = FALSE, "revoked_at" = NOW(), "revoked_by_id" = $1, "updated_at" = NOW() WHERE "user_id" = $2',
        [adminId, athlete.id],
      );
    });
    expect(await grants()).toEqual({ athlete: true, trainer: false, admin: false });
    await trainerDenied();
    await athleteAllowed();

    // A stale role=TRAINER does not override an explicitly revoked profile.
    await withDisposableDatabase(async (db) => {
      await db.query('UPDATE "users" SET "role" = $1, "updated_at" = NOW() WHERE "id" = $2', [
        'TRAINER',
        athlete.id,
      ]);
    });
    expect(await grants()).toEqual({ athlete: true, trainer: false, admin: false });
    await trainerDenied();
    await athleteAllowed();

    // Legacy trainer with no profile has both grants; neither Web side may be lost.
    await withDisposableDatabase(async (db) => {
      await db.query('DELETE FROM "trainer_profiles" WHERE "user_id" = $1', [athlete.id]);
    });
    expect(await grants()).toEqual({ athlete: true, trainer: true, admin: false });
    await trainerAllowed();
    await athleteAllowed();

    // Session is unchanged: current ADMIN privilege must NOT unlock Athlete or Trainer pages.
    await withDisposableDatabase(async (db) => {
      await db.query('UPDATE "users" SET "role" = $1, "updated_at" = NOW() WHERE "id" = $2', [
        'ADMIN',
        athlete.id,
      ]);
    });
    expect(await grants()).toEqual({ athlete: false, trainer: false, admin: true });
    await trainerDenied();
    for (const path of ['/athlete/programs', '/athlete/trainers']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'Доступ заборонено' })).toBeVisible();
    }
  } finally {
    await withDisposableDatabase(async (db) => {
      await db.query('DELETE FROM "trainer_profiles" WHERE "user_id" = $1', [athlete.id]);
      await db.query('DELETE FROM "users" WHERE "id" = $1', [adminId]);
    });
  }
});
