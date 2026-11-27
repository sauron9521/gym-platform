import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { withDisposableDatabase } from '../support/real-api-accounts';
import { expectNoAxeWcagViolations } from '../support/axe-wcag';

const trainer = 'http://localhost:3202';
const athlete = 'http://127.0.0.1:3200';
const password = 'BrowserTest123!';

test('Trainer Inbox shares read state, protects live client targets and revokes access', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const email = 'trainer-inbox-' + randomUUID() + '@example.test';
  const reviewer = randomUUID(),
    client = randomUUID(),
    relation = randomUUID(),
    notice = randomUUID();
  const personal = randomUUID();
  await page.context().addCookies([{ name: 'gym-locale', value: 'en', url: trainer }]);
  await page.goto(trainer + '/workspace/notifications');
  await expect(page.getByRole('alert')).toContainText('You do not have access');
  await expect(page.getByRole('link', { name: /Notifications \(/ })).toHaveCount(0);
  const register = await page.request.post(trainer + '/backend/auth/register', {
    data: { email, password },
    headers: { origin: trainer },
  });
  expect(register.status()).toBe(201);
  const me = await page.request.get(trainer + '/backend/users/me');
  expect(me.status()).toBe(200);
  const user = (await me.json()).id as string;
  try {
    await withDisposableDatabase(async (db) => {
      await db.query(
        'INSERT INTO users (id,email,password_hash,role,updated_at) VALUES ($1,$2,$3,$4,NOW()),($5,$6,$3,$7,NOW())',
        [
          reviewer,
          reviewer + '@example.test',
          'no-usable-password',
          'ADMIN',
          client,
          client + '@example.test',
          'ATHLETE',
        ],
      );
      await db.query(
        'INSERT INTO trainer_profiles (id,user_id,is_active,approved_at,approved_by_id,updated_at) VALUES ($1,$2,TRUE,NOW(),$3,NOW())',
        [randomUUID(), user, reviewer],
      );
      await db.query(
        'INSERT INTO trainer_athletes (id,trainer_id,athlete_id,initiated_by_id,status,updated_at) VALUES ($1,$2,$3,$2,$4,NOW())',
        [relation, user, client, 'ACTIVE'],
      );
      await db.query(
        "INSERT INTO notifications (id,event_id,recipient_id,scope,category,type,template_key,trainer_relationship_id,created_at) VALUES ($1,$1,$2,'USER','TRAINER','trainer.invitation.accepted','trainer.invitation.accepted',$3,NOW())",
        [notice, user, relation],
      );
      // 20 additional personal account records force a cursor page; never seed
      // an ADMIN record into a USER projection.
      await db.query(
        "INSERT INTO notifications (id,event_id,recipient_id,scope,category,type,template_key,created_at) SELECT gen_random_uuid()::text, gen_random_uuid()::text,$1,'USER','ACCOUNT','account.security.changed','account.security.changed',NOW()-INTERVAL '1 minute' FROM generate_series(1,19)",
        [user],
      );
      await db.query(
        "INSERT INTO notifications (id,event_id,recipient_id,scope,category,type,template_key,created_at) VALUES ($1,$1,$2,'USER','ACCOUNT','account.security.changed','account.security.changed',NOW()-INTERVAL '2 minutes')",
        [personal, user],
      );
      await db.query(
        "INSERT INTO notifications (id,event_id,recipient_id,scope,category,type,template_key) VALUES ($1,$1,$2,'ADMIN','ACCOUNT','admin.trainer.review.required','admin.trainer.review.required')",
        [randomUUID(), user],
      );
    });
    await page.context().clearCookies();
    await page.context().addCookies([{ name: 'gym-locale', value: 'en', url: trainer }]);
    await page.goto(trainer + '/login');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(trainer + '/workspace');
    const bell = page.getByRole('link', { name: 'Notifications (21 unread)' });
    await expect(bell).toBeVisible();
    await bell.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(trainer + '/workspace/notifications');
    await expect(page.getByRole('heading', { name: 'Coaching invitation accepted' })).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Notifications' }).getByRole('listitem'),
    ).toHaveCount(20);
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(
      page.getByRole('list', { name: 'Notifications' }).getByRole('listitem'),
    ).toHaveCount(21);
    await page.getByRole('combobox', { name: 'Category' }).selectOption('TRAINER');
    await expect(
      page.getByRole('list', { name: 'Notifications' }).getByRole('listitem'),
    ).toHaveCount(1);
    await page.getByRole('combobox', { name: 'Theme' }).selectOption('light');
    await expectNoAxeWcagViolations(page);
    await page.getByRole('combobox', { name: 'Theme' }).selectOption('dark');
    await expectNoAxeWcagViolations(page);
    await page.getByRole('button', { name: 'Mark as read: Coaching invitation accepted' }).click();
    await expect(page.getByRole('link', { name: 'Notifications (20 unread)' })).toBeVisible();
    // Use the Athlete origin and its independent cookie to prove cross-app parity.
    const ctx = await browser.newContext();
    try {
      const login = await ctx.request.post(athlete + '/backend/auth/login', {
        data: { email, password },
        headers: { origin: athlete },
      });
      expect(login.status()).toBe(200);
      const read = await ctx.request.get(athlete + '/backend/notifications/' + notice);
      expect(read.status()).toBe(200);
      expect((await read.json()).readAt).toEqual(expect.any(String));
      const count = await ctx.request.get(athlete + '/backend/notifications/unread-count');
      expect(await count.json()).toEqual({ count: 20 });
    } finally {
      await ctx.close();
    }
    await page.getByRole('button', { name: 'Open client' }).click();
    await expect(page).toHaveURL(trainer + '/workspace/clients/' + relation);
    await expect(page.getByRole('heading', { name: 'Client progress' })).toBeVisible();
    await page.getByRole('link', { name: /Notifications/ }).click();
    await page.getByRole('combobox', { name: 'Category' }).selectOption('TRAINER');
    await expect(page.getByRole('button', { name: 'Open client' })).toBeVisible();
    // Termination after list fetch, before explicit navigation.
    await withDisposableDatabase((db) =>
      db.query(
        "UPDATE trainer_athletes SET status='TERMINATED',ended_at=NOW(),ended_by_id=$1,updated_at=NOW() WHERE id=$2",
        [client, relation],
      ),
    );
    await page.getByRole('button', { name: 'Open client' }).click();
    await expect(
      page.getByText('This notification or client is no longer available.'),
    ).toBeVisible();
    await expect(page).toHaveURL(trainer + '/workspace/notifications');
    await page.getByRole('combobox', { name: 'Category' }).selectOption('ALL');
    await page.getByRole('checkbox', { name: 'Unread only' }).check();
    await expect(page.getByRole('button', { name: 'Mark all as read' })).toBeEnabled();
    await page.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(page.getByText('No notifications to show.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Notifications (0 unread)' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Language' }).selectOption('uk');
    await expect(page.getByRole('heading', { name: 'Сповіщення' })).toBeVisible();
    await withDisposableDatabase((db) =>
      db.query(
        'UPDATE trainer_profiles SET is_active=FALSE,revoked_at=NOW(),revoked_by_id=$1,updated_at=NOW() WHERE user_id=$2',
        [reviewer, user],
      ),
    );
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('link', { name: /Сповіщення \(/ })).toHaveCount(0);
    const denied = await page.request.get(trainer + '/backend/notifications', {
      headers: { 'x-inbox-audience': 'trainer', 'x-inbox-owner': user },
    });
    expect(denied.status()).toBe(403);
    const personalInbox = await page.request.get(trainer + '/backend/notifications/' + personal);
    expect(personalInbox.status()).toBe(200);
  } finally {
    await withDisposableDatabase(async (db) => {
      await db.query('DELETE FROM notifications WHERE recipient_id=$1', [user]);
      await db.query('DELETE FROM trainer_athletes WHERE id=$1', [relation]);
      await db.query('DELETE FROM trainer_profiles WHERE user_id=$1', [user]);
      await db.query('DELETE FROM users WHERE id IN ($1,$2,$3)', [user, reviewer, client]);
    });
  }
});
