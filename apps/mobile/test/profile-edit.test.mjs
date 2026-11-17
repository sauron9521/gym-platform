import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  editProfileSchema,
  profilePatch,
} from '../src/features/profile/lib/edit-profile-schema.ts';

test('profile edit accepts localized decimal weights and empty optional fields', () => {
  const values = editProfileSchema.parse({
    displayName: '  Alex  ',
    firstName: '',
    lastName: '',
    height: '193',
    weight: '82,5',
  });
  assert.deepEqual(profilePatch(values), {
    displayName: 'Alex',
    firstName: null,
    lastName: null,
    height: 193,
    weight: 82.5,
  });
});

test('profile edit rejects invalid measurements', () => {
  for (const invalid of ['-2', 'abc', '900']) {
    assert.equal(
      editProfileSchema.safeParse({
        displayName: '',
        firstName: '',
        lastName: '',
        height: invalid,
        weight: '75',
      }).success,
      false,
    );
  }
});

test('profile fields follow server bounds and decimal precision', () => {
  const valid = { displayName: 'A', firstName: 'B', lastName: '', height: '50', weight: '1' };
  assert.equal(editProfileSchema.safeParse(valid).success, true);
  assert.equal(editProfileSchema.safeParse({ ...valid, height: '300', weight: '600' }).success, true);
  assert.equal(editProfileSchema.safeParse({ ...valid, firstName: 'a'.repeat(100) }).success, true);

  for (const invalid of [
    { ...valid, height: '49' },
    { ...valid, height: '301' },
    { ...valid, height: '192.5' },
    { ...valid, weight: '0' },
    { ...valid, weight: '601' },
    { ...valid, weight: '80.123' },
    { ...valid, weight: '1.2.3' },
    { ...valid, displayName: 'a'.repeat(101) },
  ]) {
    assert.equal(editProfileSchema.safeParse(invalid).success, false);
  }
});

test('profile mutation keeps successful API response in account cache', () => {
  const mutation = readFileSync(
    new URL('../src/features/profile/model/edit-profile-mutation.ts', import.meta.url),
    'utf8',
  );
  assert.match(mutation, /PATCH\('\/users\/me'/);
  assert.match(mutation, /!response\.data/);
  assert.match(mutation, /queryClient\.setQueryData\(accountQueryKeys\.me\(account\.id\), updated\)/);
  assert.match(mutation, /retry: false/);
});
