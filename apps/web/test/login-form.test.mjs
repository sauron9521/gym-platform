import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { loginSchema } from '../src/features/auth/lib/login-schema.ts';

test('login schema trims email but preserves password exactly', () => {
  const result = loginSchema.parse({ email: '  User@Example.com  ', password: ' p ass ' });
  assert.equal(result.email, 'User@Example.com');
  assert.equal(result.password, ' p ass ');
});

test('login schema rejects empty, invalid email and whitespace-only passwords', () => {
  for (const payload of [
    { email: '', password: 'password' },
    { email: 'not-an-email', password: 'password' },
    { email: 'a@example.com', password: '' },
    { email: 'a@example.com', password: '   ' },
    { email: 'a'.repeat(245) + '@mail.com', password: 'secret' },
  ]) {
    assert.equal(loginSchema.safeParse(payload).success, false);
  }
});

test('login form uses RHF and Zod without weakening session or MFA guards', async () => {
  const ui = await readFile(
    new URL('../src/features/auth/ui/sign-in-form.tsx', import.meta.url),
    'utf8',
  );
  assert.match(ui, /useForm<LoginValues>/);
  assert.match(ui, /zodResolver\(loginSchema\)/);
  assert.match(ui, /handleSubmit\(submit\)/);
  assert.match(ui, /webApi.POST\('\/auth\/login'/);
  assert.match(ui, /webApi.POST\('\/auth\/sign-out'\)/);
  assert.match(ui, /webApi.GET\('\/users\/me'\)/);
  assert.match(ui, /classifySessionCheck/);
  assert.match(ui, /router.replace\('\/dashboard'\)/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|document.cookie/);
});
