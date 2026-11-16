import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'vitest';

import {
  buildProfilePatch,
  getProfileErrorMessage,
  profileSchema,
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

test('Zod profile schema maps nullable fields and decimal weights', () => {
  const draft = toProfileDraft(account);
  assert.equal(draft.weight, '81.5');
  assert.equal(draft.lastName, '');
  const result = buildProfilePatch({ ...draft, weight: '81.25', height: '' });
  assert.equal(result.data.weight, 81.25);
  assert.equal(result.data.height, null);
  assert.equal(profileSchema.safeParse(draft).success, true);
});

test('Zod rejects invalid height, fractional precision, timezone and birthday', () => {
  const draft = toProfileDraft(account);
  for (const changes of [
    { height: '-10' },
    { height: '193.5' },
    { weight: 'Infinity' },
    { weight: '81.255' },
    { weight: '601' },
    { birthday: '2999-01-01' },
    { birthday: '2026-02-30' },
    { timezone: 'Invalid/TimeZone' },
    { timezone: 'GMT' },
  ]) {
    assert.equal(profileSchema.safeParse({ ...draft, ...changes }).success, false);
    assert.ok(buildProfilePatch({ ...draft, ...changes }).error);
  }
  assert.equal(buildProfilePatch({ ...draft, timezone: 'UTC' }).data.timezone, 'UTC');
});

test('valid decimal weights are accepted without floating-point precision errors', () => {
  const draft = toProfileDraft(account);
  for (const weight of ['1.16', '75.99', '81.21']) {
    assert.equal(buildProfilePatch({ ...draft, weight }).data?.weight, Number(weight));
  }
});

test('Zod trim follows API semantics and clears optional fields as null', () => {
  const draft = toProfileDraft(account);
  const result = buildProfilePatch({ ...draft, firstName: '  Ruslan ', lastName: '   ' });
  assert.equal(result.data.firstName, 'Ruslan');
  assert.equal(result.data.lastName, null);
});

test('profile errors do not disclose raw backend body', () => {
  assert.match(getProfileErrorMessage(401), /Сесію/);
  assert.match(getProfileErrorMessage(403), /прав/);
  assert.match(getProfileErrorMessage(500), /Спробуйте/);
});

test('profile remains protected and uses shared TanStack query and mutation flows', async () => {
  const page = await readFile(
    new URL('../src/app/(protected)/profile/page.tsx', import.meta.url),
    'utf8',
  );
  const ui = await readFile(
    new URL('../src/features/profile/ui/profile-editor.tsx', import.meta.url),
    'utf8',
  );
  const query = await readFile(
    new URL('../src/features/profile/api/profile-query.ts', import.meta.url),
    'utf8',
  );
  const mutations = await readFile(
    new URL('../src/features/profile/api/profile-mutations.ts', import.meta.url),
    'utf8',
  );
  assert.match(page, /verifyServerSession/);
  assert.match(page, /force-dynamic/);
  assert.match(ui, /useForm<ProfileDraft>/);
  assert.match(ui, /zodResolver\(profileSchema\)/);
  assert.match(ui, /handleSubmit\(submit\)/);
  assert.match(ui, /useQuery\(profileQueryOptions\(\)\)/);
  assert.match(ui, /useUpdateProfileMutation\(\)/);
  assert.match(ui, /await mutation.mutateAsync\(result.data\)/);
  assert.match(ui, /const updated = await query.refetch\(\)/);
  assert.match(ui, /reset\(toProfileDraft\(updated.data\)\)/);
  assert.match(ui, /keepDirtyValues: true/);
  assert.match(ui, /onChanged=\{loadProfile\}/);
  assert.match(ui, /useAuthFailure\(\)/);
  assert.match(ui, /if \(!account \|\| mutation.isPending\) return/);
  assert.match(query, /webApi.GET\('\/users\/me', \{ signal \}\)/);
  assert.match(query, /retry: false/);
  assert.match(mutations, /webApi.PATCH\('\/users\/me'/);
  assert.match(mutations, /response.status !== 200/);
  assert.match(mutations, /queryClient.cancelQueries/);
  assert.match(mutations, /refetchType: 'none'/);
  assert.match(mutations, /useAuthFailure\(\)/);
  assert.match(mutations, /retry: false/);
  assert.doesNotMatch(ui, /webApi.GET|webApi.PATCH|localStorage|sessionStorage|document.cookie/);
});

test('profile query key is scoped to the signed-in account view', async () => {
  const { profileQueryKeys } = await import('../src/features/profile/lib/profile-query-keys.ts');
  assert.deepEqual(profileQueryKeys.all, ['profile']);
  assert.deepEqual(profileQueryKeys.me(), ['profile', 'me']);
});
