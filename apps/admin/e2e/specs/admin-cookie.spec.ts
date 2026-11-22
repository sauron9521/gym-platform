import { expect, test, type Page } from '@playwright/test';

const adminUrl = 'http://localhost:3310';
const apiUrl = 'http://127.0.0.1:3311';

async function signIn(page: Page, email = 'admin@example.test') {
  await page.goto('/sign-in');
  await page.locator('#admin-email').fill(email);
  await page.locator('#admin-password').fill('FixturePassword123!');
  await page.locator('button[type=submit]').click();
}

test('Chromium stores a secure host-only Admin cookie through the real Next rewrite', async ({
  page,
  context,
}) => {
  await signIn(page);
  await expect(page).toHaveURL(adminUrl + '/');
  await expect(page.locator('nav[aria-label]').first()).toBeVisible();

  const all = await context.cookies(adminUrl);
  const admin = all.find((entry) => entry.name === '__Host-admin-sid');
  expect(admin).toMatchObject({
    domain: 'localhost',
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'Lax',
  });
  expect(all.some((entry) => entry.name === '__Host-sid')).toBe(false);

  expect((await context.cookies(apiUrl)).some((entry) => entry.name === '__Host-admin-sid')).toBe(
    false,
  );
  expect((await page.request.get('/backend/auth/admin-session')).status()).toBe(200);
});

async function signInOrdinary(page: Page) {
  await page.goto('/sign-in');
  const status = await page.evaluate(async () => {
    const response = await fetch('/backend/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
    });
    return response.status;
  });
  expect(status).toBe(200);
}

test('ordinary cookie never opens Admin; Admin logout preserves the regular cookie', async ({
  page,
  context,
}) => {
  await signInOrdinary(page);
  await page.goto('/');
  await expect(page.locator('main[role=alert]')).toBeVisible();
  expect((await page.request.get('/backend/auth/admin-session')).status()).toBe(401);

  await signIn(page);
  await expect(page).toHaveURL(adminUrl + '/');
  expect((await context.cookies(adminUrl)).map((entry) => entry.name)).toEqual(
    expect.arrayContaining(['__Host-sid', '__Host-admin-sid']),
  );
  const status = await page.evaluate(async () => {
    const response = await fetch('/backend/auth/admin-sign-out', {
      method: 'POST',
      credentials: 'same-origin',
    });
    return response.status;
  });
  expect(status).toBe(204);
  const after = await context.cookies(adminUrl);
  expect(after.find((entry) => entry.name === '__Host-admin-sid')).toBeUndefined();
  expect(after.find((entry) => entry.name === '__Host-sid')?.value).toBe('ordinary-test-token');
  expect((await page.request.get('/backend/users/me')).status()).toBe(200);
  await page.goto('/');
  await expect(page.locator('main[role=alert]')).toBeVisible();
});

test('revoking Admin sessions does not remove the regular login cookie', async ({
  page,
  context,
}) => {
  await signInOrdinary(page);
  await signIn(page);
  await expect(page).toHaveURL(adminUrl + '/');
  const token = (await context.cookies(adminUrl)).find(
    (entry) => entry.name === '__Host-admin-sid',
  );
  expect(token).toBeDefined();
  const revoke = await page.request.post('/backend/auth/admin-sessions/revoke-all');
  expect(revoke.status()).toBe(204);
  expect((await page.request.get('/backend/auth/admin-session')).status()).toBe(401);
  expect((await context.cookies(adminUrl)).some((entry) => entry.name === '__Host-admin-sid')).toBe(
    false,
  );
  expect(
    (await context.cookies(adminUrl)).find((entry) => entry.name === '__Host-sid')?.value,
  ).toBe('ordinary-test-token');
  await page.goto('/');
  await expect(page.locator('main[role=alert]')).toBeVisible();
});

test('pending MFA is cleared before the dashboard can open', async ({ page, context }) => {
  const signOut = page.waitForResponse((response) =>
    response.url().includes('/backend/auth/admin-sign-out'),
  );
  await signIn(page, 'pending@example.test');
  expect((await signOut).status()).toBe(204);
  await expect(page.locator('p[role=alert]')).toBeVisible();
  await expect(page).toHaveURL(adminUrl + '/sign-in');
  expect((await context.cookies(adminUrl)).some((entry) => entry.name === '__Host-admin-sid')).toBe(
    false,
  );
  await page.goto('/');
  await expect(page.locator('main[role=alert]')).toBeVisible();
});
