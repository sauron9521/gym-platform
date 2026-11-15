import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('shared auth failure clears private queries only on HTTP 401', async () => {
  const authFailure = await readFile(
    new URL('../src/shared/api/use-auth-failure.ts', import.meta.url),
    'utf8',
  );

  assert.match(authFailure, /error\.status !== 401/);
  assert.match(authFailure, /queryClient\.clear\(\)/);
  assert.match(authFailure, /router\.replace\('\/login'\)/);
  assert.match(authFailure, /redirecting\.current/);
  assert.doesNotMatch(authFailure, /localStorage|sessionStorage/);
});

test('existing mutation modules reuse the same unauthorized-session handler', async () => {
  for (const path of [
    '../src/features/training-programs/api/training-program-mutations.ts',
    '../src/features/trainer-athletes/api/trainer-athlete-mutations.ts',
  ]) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /useAuthFailure\(\)/);
    assert.match(source, /onError/);
    assert.doesNotMatch(source, /queryClient\.clear\(\)/);
  }
});
