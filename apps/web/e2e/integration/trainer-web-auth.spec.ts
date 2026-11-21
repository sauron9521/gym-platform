import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { withDisposableDatabase } from '../support/real-api-accounts';

const trainerOrigin = 'http://localhost:3202';
const athleteOrigin = 'http://127.0.0.1:3200';
const password = 'BrowserTest123!';

/**
 * Full real Next Trainer -> same-origin rewrite -> Nest -> PostgreSQL journey.
 * The test API and browser must use explicitly distinct loopback hostnames:
 * host-only session cookies for localhost must never reach 127.0.0.1.
 */
test('Trainer browser requires live approval, protects Origin/cookies, and revokes sign-out', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const id = randomUUID();
  const email = `trainer-browser-${id}@example.test`;
  const reviewerId = randomUUID();
  const profileId = randomUUID();
  const dashboardAthleteId = randomUUID();
  const dashboardRelationId = randomUUID();
  const otherTrainerId = randomUUID();
  const otherRelationId = randomUUID();
  const dashboardAthleteEmail = `trainer-client-${dashboardAthleteId}@example.test`;
  const otherTrainerEmail = `foreign-trainer-${otherTrainerId}@example.test`;

  // Exercise a real server-rendered route without an authenticated session.
  await page.context().addCookies([{ name: 'gym-locale', value: 'en', url: trainerOrigin }]);
  await page.goto(`${trainerOrigin}/workspace`);
  await expect(page.getByRole('heading', { name: 'Sign-in required' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);

  // Browser registration reuses the existing Nest identity. The disposable DB
  // is explicitly test-only; there is no bypass endpoint for trainer approval.
  const registration = await page.request.post(`${trainerOrigin}/backend/auth/register`, {
    data: { email, password },
    headers: { origin: trainerOrigin },
  });
  expect(registration.status()).toBe(201);
  const me = await page.request.get(`${trainerOrigin}/backend/users/me`);
  expect(me.status()).toBe(200);
  const user: { id: string; role: string } = await me.json();
  expect(user.role).toBe('ATHLETE');
  await page.context().clearCookies();
  await page.context().addCookies([{ name: 'gym-locale', value: 'en', url: trainerOrigin }]);

  async function login() {
    await page.goto(`${trainerOrigin}/login`);
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
  }

  // A real ATHLETE login cannot acquire Trainer rights by choosing this UI.
  await login();
  await expect(page.locator('p[role="alert"]')).toContainText('not been approved');
  await expect(page).toHaveURL(`${trainerOrigin}/login`);
  const deniedSession = await page.request.get(`${trainerOrigin}/backend/users/me/capabilities`);
  expect(deniedSession.status()).toBe(401);

  try {
    // A test-only reviewer approves the TrainerProfile directly in an isolated
    // database; no elevated account or credentials enter browser storage.
    await withDisposableDatabase(async (db) => {
      await db.query(
        'INSERT INTO "users" ("id", "email", "password_hash", "role", "updated_at") VALUES ($1, $2, $3, $4, NOW())',
        [reviewerId, `trainer-reviewer-${reviewerId}@example.test`, 'no-usable-password', 'ADMIN'],
      );
      await db.query(
        'INSERT INTO "trainer_profiles" ("id", "user_id", "is_active", "approved_at", "approved_by_id", "updated_at") VALUES ($1, $2, TRUE, NOW(), $3, NOW())',
        [profileId, user.id, reviewerId],
      );
    });

    await login();
    await expect(page).toHaveURL(`${trainerOrigin}/workspace`);
    await expect(page.getByRole('heading', { name: 'Trainer dashboard' })).toBeVisible();
    await expect(page.getByText('No active clients yet.')).toBeVisible();

    // The same identity may be an athlete under a second trainer. Its trainer
    // dashboard must scope SQL BEFORE pagination/count, never show that
    // other trainer or leak their email.
    await withDisposableDatabase(async (db) => {
      await db.query(
        'INSERT INTO "users" ("id", "email", "password_hash", "role", "updated_at") VALUES ($1, $2, $3, $4, NOW()), ($5, $6, $7, $8, NOW())',
        [
          dashboardAthleteId,
          dashboardAthleteEmail,
          'no-usable-password',
          'ATHLETE',
          otherTrainerId,
          otherTrainerEmail,
          'no-usable-password',
          'TRAINER',
        ],
      );
      await db.query(
        'INSERT INTO "trainer_athletes" ("id", "trainer_id", "athlete_id", "initiated_by_id", "status", "updated_at") VALUES ($1, $2, $3, $2, $4, NOW()), ($5, $6, $2, $6, $4, NOW())',
        [
          dashboardRelationId,
          user.id,
          dashboardAthleteId,
          'ACTIVE',
          otherRelationId,
          otherTrainerId,
        ],
      );
    });
    await page.goto(`${trainerOrigin}/workspace`);
    await expect(page.getByRole('heading', { name: 'My clients' })).toBeVisible();
    await expect(page.getByText(dashboardAthleteEmail)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Active clients' })).toContainText('1');
    await expect(page.getByText(otherTrainerEmail)).toHaveCount(0);
    await expect(page.getByText('No active clients yet.')).toHaveCount(0);

    const authenticatedCookies = (await page.context().cookies([trainerOrigin])).filter(
      (cookie) => cookie.httpOnly,
    );
    expect(authenticatedCookies.length).toBeGreaterThan(0);
    for (const cookie of authenticatedCookies) {
      expect(cookie.domain).toBe('localhost');
      expect(cookie.sameSite).not.toBe('None');
    }
    const athleteCookies = await page.context().cookies([athleteOrigin]);
    for (const cookie of authenticatedCookies) {
      expect(athleteCookies.find((other) => other.name === cookie.name)).toBeUndefined();
    }

    // A forged Origin must be rejected by Nest, not merely by browser CORS.
    const csrf = await page.request.post(`${trainerOrigin}/backend/auth/sign-out`, {
      headers: { origin: 'https://attacker.example.test' },
    });
    expect(csrf.status()).toBe(403);
    await page.goto(`${trainerOrigin}/workspace`);
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

    // A live revocation must close the server-rendered Trainer workspace while
    // preserving the existing session's personal Athlete capability.
    await withDisposableDatabase(async (db) => {
      await db.query(
        'UPDATE "trainer_profiles" SET "is_active" = FALSE, "revoked_at" = NOW(), "revoked_by_id" = $1, "updated_at" = NOW() WHERE "user_id" = $2',
        [reviewerId, user.id],
      );
    });
    await page.goto(`${trainerOrigin}/workspace`);
    await expect(page.getByRole('heading', { name: 'Trainer access not approved' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);

    // Restore approval, then verify that current ADMIN elevation denies Trainer
    // even though the old browser session and TrainerProfile are unchanged.
    await withDisposableDatabase(async (db) => {
      await db.query(
        'UPDATE "trainer_profiles" SET "is_active" = TRUE, "revoked_at" = NULL, "revoked_by_id" = NULL, "updated_at" = NOW() WHERE "user_id" = $1',
        [user.id],
      );
      await db.query('UPDATE "users" SET "role" = $1, "updated_at" = NOW() WHERE "id" = $2', [
        'ADMIN',
        user.id,
      ]);
    });
    await page.goto(`${trainerOrigin}/workspace`);
    await expect(page.getByRole('heading', { name: 'Trainer access not approved' })).toBeVisible();

    await withDisposableDatabase(async (db) => {
      await db.query('UPDATE "users" SET "role" = $1, "updated_at" = NOW() WHERE "id" = $2', [
        'ATHLETE',
        user.id,
      ]);
    });
    await page.goto(`${trainerOrigin}/workspace`);
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

    // The Sign out UI is backed by Nest session revocation, not a cosmetic
    // local state change. A subsequent protected GET must be unauthenticated.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(`${trainerOrigin}/login`);
    const signedOut = await page.request.get(`${trainerOrigin}/backend/users/me/capabilities`);
    expect(signedOut.status()).toBe(401);
    await page.goto(`${trainerOrigin}/workspace`);
    await expect(page.getByRole('heading', { name: 'Sign-in required' })).toBeVisible();

    // An expired server-side session must be rejected even if the browser
    // still has its previously valid, HttpOnly cookie.
    await login();
    await expect(page).toHaveURL(`${trainerOrigin}/workspace`);
    await withDisposableDatabase(async (db) => {
      const expired = await db.query(
        `UPDATE "sessions" SET "expires_at" = NOW() - INTERVAL '1 day' WHERE "user_id" = $1`,
        [user.id],
      );
      expect(expired.rowCount).toBeGreaterThan(0);
    });
    await page.goto(`${trainerOrigin}/workspace`);
    await expect(page.getByRole('heading', { name: 'Sign-in required' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
  } finally {
    await withDisposableDatabase(async (db) => {
      await db.query('DELETE FROM "trainer_athletes" WHERE "id" IN ($1, $2)', [
        dashboardRelationId,
        otherRelationId,
      ]);
      await db.query('DELETE FROM "users" WHERE "id" IN ($1, $2)', [
        dashboardAthleteId,
        otherTrainerId,
      ]);
      await db.query('DELETE FROM "trainer_profiles" WHERE "user_id" = $1', [user.id]);
      await db.query('DELETE FROM "users" WHERE "id" = $1', [reviewerId]);
    });
  }
});
