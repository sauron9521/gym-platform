import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  MAX_AVATAR_BYTES,
  avatarErrorMessage,
  getAvatarInitials,
  getAvatarSource,
  validateAvatarFile,
} from '../src/features/profile/lib/avatar.ts';

test('avatar validation accepts supported formats up to 2 MiB', () => {
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    assert.equal(validateAvatarFile({ type, size: MAX_AVATAR_BYTES }), null);
  }
  assert.match(validateAvatarFile({ type: 'image/png', size: 0 }), /непорожній/);
  assert.match(validateAvatarFile({ type: 'image/png', size: MAX_AVATAR_BYTES + 1 }), /2 МіБ/);
  assert.match(validateAvatarFile({ type: 'image/svg+xml', size: 100 }), /PNG/);
});

test('avatar source accepts only backend-issued key paths', () => {
  const key = '123e4567-e89b-42d3-a456-426614174000.png';
  assert.equal(getAvatarSource(`/avatars/${key}`), `/backend/avatars/${key}`);
  for (const value of [
    'https://example.com/image.png',
    '//example.com/evil.png',
    '/avatars/../../admin',
    '/avatars/a.png',
    '/backend/avatars/evil.png',
  ]) {
    assert.equal(getAvatarSource(value), null);
  }
});

test('initials and errors do not disclose upstream content', () => {
  assert.equal(getAvatarInitials('Іван Петренко', 'a@example.com'), 'ІП');
  assert.equal(getAvatarInitials('', 'a@example.com'), 'A');
  assert.match(avatarErrorMessage(413), /формат/);
  assert.match(avatarErrorMessage(429), /Забагато/);
});

test('avatar writes use typed TanStack mutation, one profile refetch and browser multipart', async () => {
  const ui = await readFile(
    new URL('../src/features/profile/ui/profile-avatar.tsx', import.meta.url),
    'utf8',
  );
  const mutations = await readFile(
    new URL('../src/features/profile/api/avatar-mutations.ts', import.meta.url),
    'utf8',
  );
  const contract = await readFile(
    new URL('../../../packages/api-client/src/generated/schema.d.ts', import.meta.url),
    'utf8',
  );
  assert.match(ui, /useAvatarMutation\(\)/);
  assert.match(ui, /mutation.mutateAsync\(\{ action: 'upload', file \}\)/);
  assert.match(ui, /mutation.mutateAsync\(\{ action: 'delete' \}\)/);
  assert.match(ui, /await onChanged\(\)/);
  assert.match(ui, /mutation.isPending/);
  assert.match(mutations, /fetch\('\/backend\/users\/me\/avatar'/);
  assert.match(mutations, /form.append\('file', input.file\)/);
  assert.match(mutations, /credentials: 'include'/);
  assert.match(mutations, /response.status !== 200/);
  assert.match(mutations, /useAuthFailure\(\)/);
  assert.match(mutations, /profileQueryKeys.me\(\)/);
  assert.match(mutations, /queryClient.cancelQueries/);
  assert.match(mutations, /refetchType: 'none'/);
  assert.match(mutations, /retry: false/);
  assert.doesNotMatch(mutations, /Content-Type|localStorage|sessionStorage|document.cookie/);
  assert.doesNotMatch(ui, /fetch\(|setSignedOut|setBusy\(/);
  assert.match(contract, /UsersController_uploadAvatar:/);
  assert.match(contract, /UsersController_deleteAvatar:/);
});
