import { randomUUID } from 'node:crypto';
import { expect, request, test } from '@playwright/test';

test('real API persists the profile and revokes the browser session', async ({ page }) => {
  const email = `browser-${randomUUID()}@example.test`;
  const password = 'BrowserTest123!';

  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);

  // Create a unique account through the real API; no DB reset or production fixtures.
  const registration = await page.request.post('/backend/auth/register', {
    data: { email, password },
    headers: { origin: 'http://127.0.0.1:3200' },
  });
  expect(registration.status()).toBe(201);
  await page.context().clearCookies();

  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === '__Host-sid');
  if (!session) throw new Error('Login did not issue a session cookie');
  expect(session).toMatchObject({ httpOnly: true, secure: true });

  await page.goto('/profile');
  await page.locator('#displayName').fill('Browser Integration Athlete');
  await page.getByRole('button', { name: 'Зберегти зміни' }).click();
  await expect(page.getByText('Профіль оновлено.')).toBeVisible();
  await page.reload();
  await expect(page.locator('#displayName')).toHaveValue('Browser Integration Athlete');

  await page.goto('/trainer/programs');
  await expect(page.getByRole('heading', { name: 'Доступ заборонено' })).toBeVisible();

  // This context never shares the browser cookie jar. Keep replaying the exact
  // issued cookie so browser-side clearing cannot make revocation appear valid.
  const replay = await request.newContext({
    baseURL: 'http://127.0.0.1:3201',
    extraHTTPHeaders: { cookie: `${session.name}=${session.value}` },
  });
  try {
    const startedAt = Date.now();
    for (let read = 0; read < 12; read += 1) {
      const response = await replay.get('/users/me');
      expect(response.status(), `profile read ${read + 1} must remain authenticated`).toBe(200);
      expect(await response.json()).toMatchObject({ email });
    }
    expect(
      Date.now() - startedAt,
      'profile reads must exercise one rate-limit minute',
    ).toBeLessThan(60_000);

    await page.goto('/dashboard');
    // Dashboard uses the request locale; session revocation must work in both languages.
    await page.getByRole('button', { name: /^(Вийти|Sign out)$/ }).click();
    await expect(page).toHaveURL(/\/login$/);

    const revoked = await replay.get('/users/me');
    expect(revoked.status(), 'the server must reject the old cookie after logout').toBe(401);
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    await replay.dispose();
  }
});
