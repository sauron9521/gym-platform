import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import { isSessionExpired } from '../src/shared/api/api-error-policy.ts';
import { accountQueryKeys, createMobileQueryClient } from '../src/shared/api/query-client.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('account query keys separate different authenticated users', () => {
  assert.notDeepEqual(accountQueryKeys.me('user-a'), accountQueryKeys.me('user-b'));
  assert.deepEqual(accountQueryKeys.me('user-a'), ['account', 'me', 'user-a']);
});

test('private account cache is erased on sign-out and account switch', () => {
  const client = createMobileQueryClient();
  client.setQueryData(accountQueryKeys.me('user-a'), { email: 'first@example.test' });

  assert.equal(client.getQueryData(accountQueryKeys.me('user-a')).email, 'first@example.test');
  client.clear();

  assert.equal(client.getQueryData(accountQueryKeys.me('user-a')), undefined);
  assert.equal(client.getQueryCache().getAll().length, 0);
  client.setQueryData(accountQueryKeys.me('user-b'), { email: 'second@example.test' });
  assert.equal(client.getQueryData(accountQueryKeys.me('user-a')), undefined);
  client.clear();
});

test('Query provider, cache isolation and guarded profile queries are wired', () => {
  const layout = read('../src/app/_layout.tsx');
  const auth = read('../src/features/auth/model/auth-context.tsx');
  const hook = read('../src/features/profile/model/account-query.ts');
  const profile = read('../src/screens/profile/ui/profile-screen.tsx');

  assert.match(layout, /<MobileQueryProvider>/);
  assert.match(auth, /queryClient\.clear\(\)/);
  assert.match(auth, /queryClient\.setQueryData\(accountQueryKeys\.me\(me\.data\.id\)/);
  assert.match(hook, /enabled: Boolean\(account\)/);
  assert.match(hook, /isSessionExpired\(response\.response\.status\)/);
  assert.match(hook, /mobileReadError\(response\.response\.status/);
  assert.equal(isSessionExpired(401), true);
  assert.equal(isSessionExpired(403), false);
  assert.match(profile, /useAccountQuery\(\)/);
});
