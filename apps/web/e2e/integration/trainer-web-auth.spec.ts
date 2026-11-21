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
  const ownProgramId = randomUUID();
  const ownVersionId = randomUUID();
  const foreignProgramId = randomUUID();
  const foreignVersionId = randomUUID();
  const ownAssignmentIds = Array.from({ length: 9 }, () => randomUUID());
  const foreignAssignmentId = randomUUID();
  const ownProgramTitle = `Trainer dashboard own ${randomUUID()}`;
  const foreignProgramTitle = `Trainer dashboard foreign ${randomUUID()}`;
  const dashboardAthleteEmail = `trainer-client-${dashboardAthleteId}@example.test`;
  const otherTrainerEmail = `foreign-trainer-${otherTrainerId}@example.test`;

  // Exercise a real server-rendered route without an authenticated session.
  await page.context().addCookies([{ name: 'gym-locale', value: 'en', url: trainerOrigin }]);
  await page.goto(`${trainerOrigin}/workspace`);
  await expect(page.getByRole('heading', { name: 'Sign-in required' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
  await page.goto(`${trainerOrigin}/workspace/clients/${dashboardRelationId}`);
  await expect(page.getByRole('heading', { name: 'Sign-in required' })).toBeVisible();

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
    await page.goto(`${trainerOrigin}/workspace/clients/${dashboardRelationId}`);
    await expect(page.getByRole('heading', { name: 'Client not found' })).toBeVisible();
    await page.goto(`${trainerOrigin}/workspace`);
    await expect(page.getByRole('heading', { name: 'Recent programs' })).toBeVisible();
    await expect(page.getByText('No programs yet.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Active clients' })).toContainText('0');
    await expect(page.getByRole('region', { name: 'Programs', exact: true })).toContainText('0');
    await expect(page.getByRole('region', { name: 'Progress' })).toContainText('0');
    await expect(
      page.getByText('Program summaries will appear after the read API integration.'),
    ).toHaveCount(0);

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
      await db.query(
        'INSERT INTO "training_programs" ("id", "trainer_id", "status", "updated_at") VALUES ($1, $2, $3, NOW()), ($4, $5, $3, NOW())',
        [ownProgramId, user.id, 'DRAFT', foreignProgramId, otherTrainerId],
      );
      await db.query(
        'INSERT INTO "training_program_versions" ("id", "program_id", "version", "title", "description", "status", "updated_at") VALUES ($1, $2, 1, $3, NULL, $4, NOW()), ($5, $6, 1, $7, NULL, $4, NOW())',
        [
          ownVersionId,
          ownProgramId,
          ownProgramTitle,
          'DRAFT',
          foreignVersionId,
          foreignProgramId,
          foreignProgramTitle,
        ],
      );
    });
    await page.goto(`${trainerOrigin}/workspace`);
    await expect(page.getByRole('heading', { name: 'My clients' })).toBeVisible();
    await expect(page.getByText(dashboardAthleteEmail)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Active clients' })).toContainText('1');
    await expect(page.getByRole('region', { name: 'Programs', exact: true })).toContainText('0');
    await expect(page.getByRole('region', { name: 'Progress' })).toContainText('0');
    await expect(page.getByText(otherTrainerEmail)).toHaveCount(0);
    await expect(page.getByText(ownProgramTitle)).toBeVisible();
    await expect(page.getByText(foreignProgramTitle)).toHaveCount(0);
    await expect(page.getByText('Total programs:')).toBeVisible();
    await expect(page.getByText('No programs yet.')).toHaveCount(0);
    await expect(page.getByText('No active clients yet.')).toHaveCount(0);

    // The active client list opens a protected SSR progress page backed by
    // TWO real Nest reads; historical and foreign relationships must not leak.
    await page.getByRole('link', { name: 'View progress' }).click();
    await expect(page).toHaveURL(`${trainerOrigin}/workspace/clients/${dashboardRelationId}`);
    await expect(page.getByRole('heading', { name: 'Client progress' })).toBeVisible();
    await expect(page.getByText(dashboardAthleteEmail)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Active assignments' })).toContainText('0');
    await expect(page.getByRole('region', { name: 'Completed workouts (30 days)' })).toContainText(
      '0',
    );
    await expect(
      page.getByText(
        'No active assignments or completed assigned-program workouts in the last 30 days.',
      ),
    ).toBeVisible();
    await expect(page.getByText(otherTrainerEmail)).toHaveCount(0);
    await expect(
      page.getByText('No programs have been assigned to this client yet.'),
    ).toBeVisible();
    await page.goto(`${trainerOrigin}/workspace/clients/${otherRelationId}`);
    await expect(page.getByRole('heading', { name: 'Client not found' })).toBeVisible();
    await expect(page.getByText(dashboardAthleteEmail)).toHaveCount(0);
    await page.goto(`${trainerOrigin}/workspace/clients/not-a-uuid`);
    await expect(page.getByRole('heading', { name: 'Client not found' })).toBeVisible();
    await page.goto(`${trainerOrigin}/workspace`);

    // Insert nine owner-assigned versions and one other trainer assignment.
    // The backend's WHERE/LIMIT/COUNT must exclude the latter before page 1/2.
    // Use a published program version as the actual assignment domain requires.
    await withDisposableDatabase(async (db) => {
      await db.query(
        'UPDATE "training_programs" SET "status" = $1, "updated_at" = NOW() WHERE "id" IN ($2, $3)',
        ['PUBLISHED', ownProgramId, foreignProgramId],
      );
      await db.query(
        'UPDATE "training_program_versions" SET "status" = $1, "published_at" = NOW(), "updated_at" = NOW() WHERE "id" IN ($2, $3)',
        ['PUBLISHED', ownVersionId, foreignVersionId],
      );

      const insertSql =
        'INSERT INTO "training_program_assignments" ("id", "version_id", "trainer_athlete_id", "athlete_id", "assigned_by_id", "status", "assigned_at", "updated_at") ' +
        "VALUES ($1, $2, $3, $4, $5, $6, NOW() - ($7::int * INTERVAL '1 minute'), NOW())";
      for (let index = 0; index < ownAssignmentIds.length; index++) {
        await db.query(insertSql, [
          ownAssignmentIds[index],
          ownVersionId,
          dashboardRelationId,
          dashboardAthleteId,
          user.id,
          index === 0 ? 'ACTIVE' : 'COMPLETED',
          String(index),
        ]);
      }
      await db.query(insertSql, [
        foreignAssignmentId,
        foreignVersionId,
        otherRelationId,
        user.id,
        otherTrainerId,
        'ACTIVE',
        '0',
      ]);
    });

    await page.goto(`${trainerOrigin}/workspace/clients/${dashboardRelationId}`);
    await expect(page.getByRole('heading', { name: 'Client progress' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Active assignments' })).toContainText('1');
    const ownAssignedList = page.getByRole('list', { name: 'Assigned programs' });
    await expect(ownAssignedList.getByRole('listitem')).toHaveCount(8);
    await expect(page.getByText('Total assignments:')).toBeVisible();
    await expect(page.getByText('9', { exact: true })).toBeVisible();
    await expect(ownAssignedList.getByText('Active', { exact: true })).toHaveCount(1);
    await expect(ownAssignedList.getByText('Completed', { exact: true })).toHaveCount(7);
    await expect(ownAssignedList.getByText(ownProgramTitle)).toHaveCount(8);
    await expect(page.getByText(foreignProgramTitle)).toHaveCount(0);

    await page.getByRole('link', { name: 'Next', exact: true }).click({ timeout: 10_000 });
    await expect(page).toHaveURL(
      `${trainerOrigin}/workspace/clients/${dashboardRelationId}?assignmentsPage=2`,
    );
    const pageTwo = page.getByRole('list', { name: 'Assigned programs' });
    await expect(pageTwo.getByRole('listitem')).toHaveCount(1);
    await expect(pageTwo.getByText('Completed', { exact: true })).toBeVisible();
    await expect(page.getByText(foreignProgramTitle)).toHaveCount(0);
    await page.getByRole('link', { name: 'Previous', exact: true }).click({ timeout: 10_000 });
    await expect(page).toHaveURL(
      `${trainerOrigin}/workspace/clients/${dashboardRelationId}?assignmentsPage=1`,
    );
    await expect(
      page.getByRole('list', { name: 'Assigned programs' }).getByRole('listitem'),
    ).toHaveCount(8);

    await page.goto(
      `${trainerOrigin}/workspace/clients/${dashboardRelationId}?assignmentsPage=100`,
    );
    await expect(
      page.getByText('No assignments on this page. Return to an earlier page.'),
    ).toBeVisible();
    await page.goto(
      `${trainerOrigin}/workspace/clients/${dashboardRelationId}?assignmentsPage=invalid`,
    );
    await expect(
      page.getByRole('list', { name: 'Assigned programs' }).getByRole('listitem'),
    ).toHaveCount(8);

    await page.goto(`${trainerOrigin}/workspace`);

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
    await expect(page.getByRole('region', { name: 'Programs', exact: true })).toHaveCount(0);
    await page.goto(`${trainerOrigin}/workspace/clients/${dashboardRelationId}`);
    await expect(page.getByRole('heading', { name: 'Trainer access not approved' })).toBeVisible();
    await expect(page.getByText(dashboardAthleteEmail)).toHaveCount(0);

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
    await page.goto(`${trainerOrigin}/workspace/clients/${dashboardRelationId}`);
    await expect(page.getByRole('heading', { name: 'Trainer access not approved' })).toBeVisible();

    await withDisposableDatabase(async (db) => {
      await db.query('UPDATE "users" SET "role" = $1, "updated_at" = NOW() WHERE "id" = $2', [
        'ATHLETE',
        user.id,
      ]);
    });
    await page.goto(`${trainerOrigin}/workspace/clients/${dashboardRelationId}`);
    await expect(page.getByText(dashboardAthleteEmail)).toBeVisible();
    await withDisposableDatabase(async (db) => {
      await db.query(
        'UPDATE "trainer_athletes" SET "status" = $1, "updated_at" = NOW() WHERE "id" = $2',
        ['TERMINATED', dashboardRelationId],
      );
    });
    await page.goto(`${trainerOrigin}/workspace/clients/${dashboardRelationId}`);
    await expect(page.getByRole('heading', { name: 'Client not found' })).toBeVisible();
    await expect(page.getByText(dashboardAthleteEmail)).toHaveCount(0);
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
      await db.query(
        'DELETE FROM "training_program_assignments" WHERE "trainer_athlete_id" IN ($1, $2)',
        [dashboardRelationId, otherRelationId],
      );
      await db.query('DELETE FROM "training_program_versions" WHERE "id" IN ($1, $2)', [
        ownVersionId,
        foreignVersionId,
      ]);
      await db.query('DELETE FROM "training_programs" WHERE "id" IN ($1, $2)', [
        ownProgramId,
        foreignProgramId,
      ]);
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
