import { expect, test, type Page } from '@playwright/test';

const origin = 'http://localhost:3320';
const email = 'admin-browser-fixture@example.test';
const password = 'AdminBrowserOnly123!';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.locator('#admin-email').fill(email);
  await page.locator('#admin-password').fill(password);
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(origin + '/');
}

async function ordinaryLogin(page: Page) {
  const status = await page.evaluate(
    async (data) => {
      const response = await fetch('/backend/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(data),
      });
      return response.status;
    },
    { email, password },
  );
  expect(status).toBe(200);
}

/**
 * One cohesive browser flow intentionally respects the real API's strict
 * three-sign-ins-per-minute limit. Separate independent tests would exhaust
 * the shared loopback IP budget and test 429s rather than Admin security.
 */
test('real Nest + PostgreSQL + Next Admin cookie lifecycle across two browsers', async ({
  browser,
}) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  try {
    const owner = await first.newPage();
    const other = await second.newPage();

    expect((await owner.request.get('/backend/auth/admin-session')).status()).toBe(401);
    await signIn(owner); // Admin sign-in 1/3.
    await expect(owner.getByRole('link', { name: 'Непрочитані сповіщення: 1' })).toBeVisible();
    await owner.getByRole('link', { name: 'Непрочитані сповіщення: 1' }).click();
    await expect(
      owner.getByRole('heading', { name: 'Заявка тренера потребує розгляду' }),
    ).toBeVisible();
    await expect(owner.locator('main')).not.toContainText('Private browser fixture note');
    await expect(owner.locator('main')).not.toContainText('admin-browser-applicant@example.test');
    await owner.getByRole('button', { name: 'Позначити прочитаним', exact: true }).click();
    await expect(owner.getByRole('link', { name: 'Непрочитані сповіщення: 0' })).toBeVisible();
    await expect(
      owner.getByRole('heading', { name: 'Заявка тренера потребує розгляду' }),
    ).toBeVisible();
    await owner.getByRole('button', { name: 'Непрочитані', exact: true }).click();
    await expect(owner.getByText('Немає сповіщень для перегляду.')).toBeVisible();

    const adminCookie = (await first.cookies(origin)).find(
      (entry) => entry.name === '__Host-admin-sid',
    );
    expect(adminCookie).toMatchObject({
      domain: 'localhost',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    });
    expect(
      (await first.cookies('http://127.0.0.1:3321')).some(
        (entry) => entry.name === '__Host-admin-sid',
      ),
    ).toBe(false);
    expect((await owner.request.get('/backend/admin/users?page=1&limit=20')).status()).toBe(200);
    expect((await owner.request.get('/backend/users/me')).status()).toBe(401);

    const foreign = 'https://untrusted-admin.example.test';
    expect(
      (
        await owner.request.get('/backend/admin/users?page=1&limit=20', {
          headers: { origin: foreign },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await owner.request.get('/backend/admin/users?page=1&limit=20', {
          headers: { referer: foreign + '/bad' },
        })
      ).status(),
    ).toBe(403);

    await ordinaryLogin(owner);
    expect((await owner.request.get('/backend/users/me')).status()).toBe(200);
    expect((await first.cookies(origin)).map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['__Host-sid', '__Host-admin-sid']),
    );

    await signIn(other); // Admin sign-in 2/3 in another browser/device.
    await other.goto('/notifications');
    await expect(
      other.getByRole('heading', { name: 'Заявка тренера потребує розгляду' }),
    ).toBeVisible();

    expect((await other.request.get('/backend/admin/users?page=1&limit=20')).status()).toBe(200);

    const signedOut = await owner.evaluate(async () => {
      const response = await fetch('/backend/auth/admin-sign-out', {
        method: 'POST',
        credentials: 'same-origin',
      });
      return response.status;
    });
    expect(signedOut).toBe(204);
    expect((await first.cookies(origin)).some((entry) => entry.name === '__Host-admin-sid')).toBe(
      false,
    );
    expect((await owner.request.get('/backend/users/me')).status()).toBe(200);
    expect((await owner.request.get('/backend/admin/users?page=1&limit=20')).status()).toBe(401);
    expect((await other.request.get('/backend/admin/users?page=1&limit=20')).status()).toBe(200);

    await signIn(owner); // Admin sign-in 3/3.
    const revoke = await owner.request.post('/backend/auth/admin-sessions/revoke-all');
    expect(revoke.status()).toBe(204);
    expect((await owner.request.get('/backend/admin/users?page=1&limit=20')).status()).toBe(401);
    expect((await other.request.get('/backend/admin/users?page=1&limit=20')).status()).toBe(401);
    expect((await owner.request.get('/backend/users/me')).status()).toBe(200);
    await other.getByRole('button', { name: 'Оновити', exact: true }).click();
    await expect(other.locator('main')).toContainText('Доступ до сповіщень змінився.');
    await expect(
      other.getByRole('heading', { name: 'Заявка тренера потребує розгляду' }),
    ).toHaveCount(0);
    await other.reload();
    await expect(other.locator('main[role=alert]')).toBeVisible();
  } finally {
    await first.close();
    await second.close();
  }
});
