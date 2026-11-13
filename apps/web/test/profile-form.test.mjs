import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  buildProfilePatch,
  getProfileErrorMessage,
  toProfileDraft,
} from '../src/features/profile/lib/profile-form.ts';

const account = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'ATHLETE',
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  profile: {
    firstName: 'Test',
    lastName: null,
    displayName: null,
    birthday: null,
    height: 193,
    weight: 81.5,
    timezone: 'Europe/Kyiv',
  },
};
test('profile maps nullable fields and preserves decimal weight', () => {
  const draft = toProfileDraft(account);
  assert.equal(draft.weight, '81.5');
  assert.equal(draft.lastName, '');
  const result = buildProfilePatch({ ...draft, weight: '81.25', height: '' });
  assert.equal(result.data.weight, 81.25);
  assert.equal(result.data.height, null);
});
test('profile rejects invalid numbers, future birthdays and bad timezones', () => {
  const draft = toProfileDraft(account);
  assert.ok(buildProfilePatch({ ...draft, weight: 'Infinity' }).error);
  assert.ok(buildProfilePatch({ ...draft, height: '-10' }).error);
  assert.ok(buildProfilePatch({ ...draft, birthday: '2999-01-01' }).error);
  assert.ok(buildProfilePatch({ ...draft, timezone: '' }).error);
});
test('profile errors do not disclose raw backend body', () => {
  assert.match(getProfileErrorMessage(401), /Сесію/);
  assert.match(getProfileErrorMessage(403), /прав/);
  assert.match(getProfileErrorMessage(500), /Спробуйте/);
});
test('profile route is protected and patch refreshes from GET, not PATCH body', async () => {
  const page = await readFile(
    new URL('../src/app/(protected)/profile/page.tsx', import.meta.url),
    'utf8',
  );
  const ui = await readFile(
    new URL('../src/features/profile/ui/profile-editor.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /verifyServerSession/);
  assert.match(page, /force-dynamic/);
  assert.match(ui, /webApi.GET\('\/users\/me'\)/);
  assert.match(ui, /webApi.PATCH\('\/users\/me'/);
  assert.match(ui, /await loadProfile\(\)/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|document.cookie/);
});
