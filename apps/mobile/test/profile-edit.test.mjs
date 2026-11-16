import assert from 'node:assert/strict';
import { test } from 'vitest';

import { editProfileSchema, profilePatch } from '../src/features/profile/lib/edit-profile-schema.ts';

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
