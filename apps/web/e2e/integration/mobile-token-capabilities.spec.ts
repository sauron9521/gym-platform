import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { createMobileApi } from '../../../mobile/src/shared/api/client';
import { MobileTokenSession } from '../../../mobile/src/features/auth/model/mobile-token-session';
import {
  hasAthleteAccess,
  hasTrainerAccess,
  hasMobileAccess,
} from '../../../mobile/src/features/auth/model/account-capabilities';
import { withDisposableDatabase, origin } from '../support/real-api-accounts';

const apiOrigin = 'http://127.0.0.1:3201';
const password = 'BrowserTest123!';

/**
 * Uses the real Expo bearer adapter + in-memory SecureStore stand-in against
 * NestJS/PostgreSQL. Native hardware SecureStore is covered separately by
 * Maestro/manual staging smoke, not by this headless Node client test.
 */
test('native token client sees the same persisted capabilities as Athlete Web across grant changes', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const id = randomUUID();
  const email = 'mobile-grants-' + id + '@example.test';
  const reviewerId = randomUUID();
  const profileId = randomUUID();
  let userId: string | null = null;
  let stored: string | null = null;
  const writes: string[] = [];
  const store = {
    read: async () => stored,
    write: async (token: string) => {
      stored = token;
      writes.push(token);
    },
    remove: async () => {
      stored = null;
    },
  };

  const guestApi = createMobileApi(apiOrigin, () => null);
  const revoked: string[] = [];
  const session = new MobileTokenSession(
    store,
    async (token) => {
      const response = await guestApi.POST('/auth/token/refresh', {
        body: { refreshToken: token },
      });
      if (response.response.status === 401 || response.response.status === 403) return null;
      if (response.response.status !== 200 || !response.data) throw new Error('Refresh failed');
      return response.data;
    },
    async (token) => {
      revoked.push(token);
      await guestApi.POST('/auth/token/revoke', { body: { refreshToken: token } });
    },
    () => undefined,
  );
  const failures: string[] = [];
  const api = createMobileApi(
    apiOrigin,
    () => session.getAccessToken(),
    (reason) => {
      failures.push(reason);
    },
  );

  try {
    await page.goto('/login');
    const registration = await page.request.post('/backend/auth/register', {
      data: { email, password },
      headers: { origin },
    });
    expect(registration.status()).toBe(201);
    const browserMe = await page.request.get('/backend/users/me');
    expect(browserMe.status()).toBe(200);
    const browserAccount: { id: string; role: string } = await browserMe.json();
    userId = browserAccount.id;

    // Native authentication does NOT borrow the Web session cookie.
    const issued = await guestApi.POST('/auth/token', { body: { email, password } });
    expect(issued.response.status).toBe(200);
    expect(issued.data).toBeTruthy();
    expect(await session.accept(issued.data!)).toBe(true);
    expect(writes).toEqual([issued.data!.refreshToken]);
    expect(stored).toBe(issued.data!.refreshToken);
    const mobileMe = await api.GET('/users/me');
    expect(mobileMe.response.status).toBe(200);
    expect(mobileMe.data).toMatchObject({ id: userId, email, role: 'ATHLETE' });
    expect((await page.request.get('/backend/users/me/capabilities')).status()).toBe(200);

    async function checkGrants(athlete: boolean, trainer: boolean, admin: boolean) {
      const response = await api.GET('/users/me/capabilities');
      expect(response.response.status).toBe(200);
      const grants = response.data!;
      expect(grants).toEqual({ athlete, trainer, admin });
      expect(hasMobileAccess(grants)).toBe((athlete || trainer) && !admin);
      expect(hasAthleteAccess(grants)).toBe(athlete && !admin);
      expect(hasTrainerAccess(grants)).toBe(trainer && !admin);
      const cookieResponse = await page.request.get('/backend/users/me/capabilities');
      expect(cookieResponse.status()).toBe(200);
      expect(await cookieResponse.json()).toEqual(grants);
    }

    await checkGrants(true, false, false);
    expect((await api.GET('/workouts')).response.status).toBe(200);
    expect((await api.GET('/training-programs')).response.status).toBe(403);

    await withDisposableDatabase(async (db) => {
      await db.query(
        'INSERT INTO "users" ("id", "email", "password_hash", "role", "updated_at") VALUES ($1, $2, $3, $4, NOW())',
        [
          reviewerId,
          'mobile-reviewer-' + reviewerId + '@example.test',
          'no-usable-password',
          'ADMIN',
        ],
      );
      await db.query(
        'INSERT INTO "trainer_profiles" ("id", "user_id", "is_active", "approved_at", "approved_by_id", "updated_at") VALUES ($1, $2, TRUE, NOW(), $3, NOW())',
        [profileId, userId!, reviewerId],
      );
    });
    await checkGrants(true, true, false);
    expect((await api.GET('/users/me')).data).toMatchObject({ id: userId, role: 'ATHLETE' });
    expect((await api.GET('/training-programs')).response.status).toBe(200);
    expect((await api.GET('/workouts')).response.status).toBe(200);

    await withDisposableDatabase(async (db) => {
      await db.query(
        'UPDATE "trainer_profiles" SET "is_active" = FALSE, "revoked_at" = NOW(), "revoked_by_id" = $1, "updated_at" = NOW() WHERE "user_id" = $2',
        [reviewerId, userId!],
      );
    });
    await checkGrants(true, false, false);
    expect((await api.GET('/training-programs')).response.status).toBe(403);
    expect((await api.GET('/workouts')).response.status).toBe(200);

    // A stale TRAINER role cannot override a revoked explicit profile.
    await withDisposableDatabase(async (db) => {
      await db.query('UPDATE "users" SET "role" = $1, "updated_at" = NOW() WHERE "id" = $2', [
        'TRAINER',
        userId!,
      ]);
    });
    await checkGrants(true, false, false);
    expect((await api.GET('/training-programs')).response.status).toBe(403);

    // Even a valid bearer token cannot cross into admin privileges.
    await withDisposableDatabase(async (db) => {
      await db.query('UPDATE "users" SET "role" = $1, "updated_at" = NOW() WHERE "id" = $2', [
        'ADMIN',
        userId!,
      ]);
    });
    await checkGrants(false, false, true);
    expect((await api.GET('/training-programs')).response.status).toBe(403);

    // Restore the athlete grant and demonstrate serialized real token rotation.
    await withDisposableDatabase(async (db) => {
      await db.query('UPDATE "users" SET "role" = $1, "updated_at" = NOW() WHERE "id" = $2', [
        'ATHLETE',
        userId!,
      ]);
    });
    await checkGrants(true, false, false);
    const previousRefresh = stored;
    expect(await session.rotate(true)).toBe(true);
    expect(stored).not.toBe(previousRefresh);
    expect(writes).toHaveLength(2);
    expect((await api.GET('/users/me')).response.status).toBe(200);

    // A Web logout must not magically revoke the independent native token.
    await page.request.post('/backend/auth/sign-out', { headers: { origin } });
    expect((await page.request.get('/backend/users/me/capabilities')).status()).toBe(401);
    expect((await api.GET('/users/me/capabilities')).response.status).toBe(200);

    // Native logout removes local credentials before best-effort server revoke.
    const refresh = session.currentRefreshToken!;
    await session.clear();
    expect(stored).toBeNull();
    expect(await session.getAccessToken()).toBeNull();
    const revokedResponse = await guestApi.POST('/auth/token/revoke', {
      body: { refreshToken: refresh },
    });
    expect(revokedResponse.response.status).toBe(204);
    expect(
      (await guestApi.POST('/auth/token/refresh', { body: { refreshToken: refresh } })).response
        .status,
    ).toBe(401);
    expect(revoked).toEqual([]);
    expect(failures).toContain('forbidden');
  } finally {
    await session.clear().catch(() => undefined);
    if (userId) {
      await withDisposableDatabase(async (db) => {
        await db.query('DELETE FROM "trainer_profiles" WHERE "user_id" = $1', [userId!]);
        await db.query('DELETE FROM "users" WHERE "id" = $1', [reviewerId]);
      });
    }
  }
});
