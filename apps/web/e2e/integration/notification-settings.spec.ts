import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { withDisposableDatabase } from '../support/real-api-accounts';
import { expectNoAxeWcagViolations } from '../support/axe-wcag';

const origin = 'http://127.0.0.1:3200';
const path = '/backend/users/me/notification-settings';

test('Notification settings persist consent and quiet hours with fail-closed writes', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = 'notification-settings-' + randomUUID() + '@example.test';
  const password = 'BrowserTest123!';
  await page.goto('/login');
  const registered = await page.request.post('/backend/auth/register', {
    data: { email, password },
    headers: { origin },
  });
  expect(registered.status()).toBe(201);
  const me = await page.request.get('/backend/users/me');
  expect(me.status()).toBe(200);
  const owner = (await me.json()).id as string;
  try {
    await page.context().addCookies([{ name: 'gym-locale', value: 'en', url: origin }]);
    await page.goto('/profile/settings');
    const panel = page.getByRole('region', { name: 'Notification settings' });
    const coaching = panel.getByRole('switch', { name: /Coaching updates/ });
    const start = panel.getByLabel('Quiet hours start');
    const end = panel.getByLabel('Quiet hours end');
    const save = panel.getByRole('button', { name: 'Save quiet hours' });
    await expect(coaching).toBeEnabled();
    await expect(coaching).not.toBeChecked();
    await expect(start).toHaveValue('22:00');
    await expect(end).toHaveValue('08:00');
    await expect(panel.getByText('Account time zone: UTC')).toBeVisible();
    await expectNoAxeWcagViolations(page);
    await coaching.click();
    await expect(coaching).toBeChecked();
    await expect(coaching).toBeEnabled();
    await end.fill('22:00');
    await expect(save).toBeDisabled();
    await expect(panel.getByText('Choose two different valid times.')).toBeVisible();
    await start.fill('23:15');
    await end.fill('07:30');
    await expect(panel.getByText('This interval continues across midnight.')).toBeVisible();
    await save.click();
    await expect(save).toBeDisabled();
    await expect(coaching).toBeEnabled();
    await panel.getByRole('radio', { name: '24 hours' }).click();
    await expect(panel.getByRole('radio', { name: '24 hours' })).toBeChecked();
    await expect(coaching).toBeEnabled();
    const result = await page.request.get(path);
    expect(result.status()).toBe(200);
    expect(await result.json()).toMatchObject({
      quietStartMinute: 1395,
      quietEndMinute: 450,
      reminderLeadMinutes: 1440,
      preferences: expect.arrayContaining([
        {
          category: 'TRAINER',
          channel: 'MOBILE_PUSH',
          enabled: true,
          consentedAt: expect.any(String),
        },
      ]),
    });
    await page.reload();
    await expect(coaching).toBeChecked();
    await expect(start).toHaveValue('23:15');
    await expect(end).toHaveValue('07:30');
    await expect(coaching).toBeEnabled();
    await coaching.click();
    await expect(coaching).not.toBeChecked();
    await expect(coaching).toBeEnabled();
    let attempts = 0;
    await page.route('**/backend/users/me/notification-settings', async (route) => {
      if (route.request().method() === 'PATCH') {
        attempts++;
        await route.abort('failed');
      } else await route.continue();
    });
    await coaching.click();
    await expect(
      panel.getByText(
        'Could not confirm the change. Review the current settings before trying again.',
      ),
    ).toBeVisible();
    await expect(coaching).not.toBeChecked();
    expect(attempts).toBe(1);
    await page.unroute('**/backend/users/me/notification-settings');
    // A real 409 fence rejects a stale page's write before the service runs.
    await page.route('**/backend/users/me/notification-settings', async (route) => {
      if (route.request().method() === 'PATCH')
        await route.continue({
          headers: { ...route.request().headers(), 'x-notification-owner': randomUUID() },
        });
      else await route.continue();
    });
    await expect(coaching).toBeEnabled();
    await coaching.click();
    await expect(
      panel.getByText('Account access changed. Reopen this page after verifying your session.'),
    ).toBeVisible();
    await expect(coaching).toHaveCount(0);
    await page.unroute('**/backend/users/me/notification-settings');
    await page.reload();
    await expect(coaching).not.toBeChecked();
    await expect(coaching).toBeEnabled();
    await withDisposableDatabase((db) =>
      db.query("UPDATE sessions SET expires_at=NOW()-INTERVAL '1 day' WHERE user_id=$1", [owner]),
    );
    await coaching.click();
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    await withDisposableDatabase((db) => db.query('DELETE FROM users WHERE id=$1', [owner]));
  }
});
