import { expect, test, type Page, type Response } from '@playwright/test';

const origin = process.env.ADMIN_STAGING_ORIGIN!;
const scope = process.env.ADMIN_STAGING_SCOPE;

async function signIn(page: Page): Promise<Response> {
  await page.goto(origin + '/sign-in', { waitUntil: 'domcontentloaded' });
  // A staging redirect to an unrelated host must fail BEFORE credentials are entered.
  if (new URL(page.url()).origin !== origin) {
    throw new Error('Unexpected staging sign-in redirect outside the allowed origin');
  }
  await page.locator('#admin-email').fill(process.env.ADMIN_STAGING_EMAIL!);
  await page.locator('#admin-password').fill(process.env.ADMIN_STAGING_PASSWORD!);
  const signedIn = page.waitForResponse(
    (response) =>
      response.url() === origin + '/backend/auth/admin-login' &&
      response.request().method() === 'POST',
  );
  await page.locator('button[type=submit]').click();
  const response = await signedIn;
  expect(response.status()).toBe(200);
  // No password, session token or raw Set-Cookie appears in assertion output.
  expect(new URL(page.url()).origin).toBe(origin);
  await expect(page).toHaveURL(origin + '/');
  const session = await page.request.get('/backend/auth/admin-session');
  expect(session.status()).toBe(200);
  expect((await session.json()).role).toBe('ADMIN');
  return response;
}

async function checkCookie(page: Page, response: Response) {
  const cookies = await page.context().cookies(origin);
  const admin = cookies.find((cookie) => cookie.name === '__Host-admin-sid');
  expect(admin).toMatchObject({
    domain: new URL(origin).hostname,
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'Lax',
  });
  const headers = await response.headersArray();
  const issued = headers
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => header.value)
    .find((value) => value.startsWith('__Host-admin-sid='));
  expect(Boolean(issued)).toBe(true);
  expect(/;\s*secure\b/i.test(issued ?? '')).toBe(true);
  expect(/;\s*httponly\b/i.test(issued ?? '')).toBe(true);
  expect(/;\s*path=\//i.test(issued ?? '')).toBe(true);
  expect(/;\s*samesite=lax\b/i.test(issued ?? '')).toBe(true);
  expect(/;\s*domain=/i.test(issued ?? '')).toBe(false);
}

test('manual staging: TLS, proxy session, Origin guard and isolated logout', async ({ page }) => {
  test.skip(scope !== 'quick', 'Only the explicitly requested quick scope runs');

  const initial = await page.request.get('/backend/auth/admin-session');
  expect(initial.status()).toBe(401);
  const login = await signIn(page);
  await checkCookie(page, login);
  const denied = await page.request.get('/backend/auth/admin-session', {
    headers: { origin: 'https://untrusted.example.invalid' },
  });
  expect(denied.status()).toBe(403);
  const deniedByReferer = await page.request.get('/backend/auth/admin-session', {
    headers: { referer: 'https://untrusted.example.invalid/unsafe' },
  });
  expect(deniedByReferer.status()).toBe(403);

  const result = await page.evaluate(async () => {
    const response = await fetch('/backend/auth/admin-sign-out', {
      method: 'POST',
      credentials: 'same-origin',
    });
    return response.status;
  });
  expect(result).toBe(204);
  expect((await page.context().cookies(origin)).some((c) => c.name === '__Host-admin-sid')).toBe(
    false,
  );
  expect((await page.request.get('/backend/auth/admin-session')).status()).toBe(401);
});

test('manual staging: server refuses idle Admin session after 16 minutes', async ({ page }) => {
  test.skip(scope !== 'idle-expiry', 'Only the explicitly requested expiry scope runs');
  const login = await signIn(page);
  await checkCookie(page, login);
  // Do not poll or request the session during this wait: it must truly go idle.
  await new Promise<void>((resolve) => setTimeout(resolve, 16 * 60_000));
  expect((await page.request.get('/backend/auth/admin-session')).status()).toBe(401);
});

test('manual staging: revoke-all invalidates a second Admin browser', async ({ browser }) => {
  test.skip(scope !== 'revoke-all', 'Requires explicit destructive staging scope');
  const first = await browser.newContext();
  const second = await browser.newContext();
  try {
    const owner = await first.newPage();
    const other = await second.newPage();
    await signIn(owner);
    await signIn(other);
    const status = await owner.evaluate(async () => {
      const response = await fetch('/backend/auth/admin-sessions/revoke-all', {
        method: 'POST',
        credentials: 'same-origin',
      });
      return response.status;
    });
    expect(status).toBe(204);
    expect((await owner.request.get('/backend/auth/admin-session')).status()).toBe(401);
    expect((await other.request.get('/backend/auth/admin-session')).status()).toBe(401);
  } finally {
    await first.close();
    await second.close();
  }
});
