import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('trainer-only list uses account-scoped active read, safe errors and restricted routing', () => {
  const model = read('../src/features/trainer-athletes/model/trainer-athletes-query.ts');
  const screen = read('../src/screens/trainer-athletes/ui/trainer-athletes-screen.tsx');
  const layout = read('../src/app/_layout.tsx');
  const profile = read('../src/screens/profile/ui/profile-screen.tsx');

  expect(model).toContain("api.GET('/trainer-athletes'");
  expect(model).toContain("enabled: account?.role === 'TRAINER'");
  expect(model).toContain("status: 'ACTIVE'");
  expect(model).toContain('shouldRetryMobileRead');
  expect(model).toContain('isSessionExpired');
  expect(model).toContain('account?.id');
  expect(screen).not.toContain('item.athlete.email');
  expect(screen).toContain('isFetchNextPageError');
  expect(layout).toContain("guard={account?.role === 'TRAINER'}");
  expect(profile).toContain("account.role === 'TRAINER'");
});

test('trainer screen translations have matching English and Ukrainian keys', () => {
  const uk = JSON.parse(read('../../../packages/i18n/src/messages/uk.json'));
  const en = JSON.parse(read('../../../packages/i18n/src/messages/en.json'));
  expect(Object.keys(uk.mobile.trainerAthletes).sort()).toEqual(
    Object.keys(en.mobile.trainerAthletes).sort(),
  );
  expect(uk.mobile.profile.myAthletes).toBeTruthy();
  expect(en.mobile.profile.myAthletes).toBeTruthy();
});
