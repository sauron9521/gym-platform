import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  getRegistrationEmailMessage,
  getRegistrationErrorMessage,
} from '../src/features/auth/lib/registration-flow.ts';
import { registrationSchema } from '../src/features/auth/lib/registration-schema.ts';

const valid = {
  email: 'user@example.test',
  password: 'Password1!',
  confirmation: 'Password1!',
};

test('registration Zod schema trims email but does not transform credentials', () => {
  const result = registrationSchema.parse({ ...valid, email: '  user@example.test  ' });
  assert.equal(result.email, valid.email);
  assert.equal(result.password, valid.password);
  assert.equal(result.confirmation, valid.confirmation);
});

test('registration rejects missing email, short passwords and invalid email addresses', () => {
  for (const change of [
    { email: ' ' },
    { email: 'not-an-email' },
    { email: 'a'.repeat(250) + '@mail.com' },
    { password: 'short', confirmation: 'short' },
    { password: '        ', confirmation: '        ' },
    { confirmation: '' },
  ]) {
    assert.equal(registrationSchema.safeParse({ ...valid, ...change }).success, false);
  }
});

test('registration reports mismatched passwords on confirmation field', () => {
  const result = registrationSchema.safeParse({ ...valid, confirmation: 'Password1?' });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.error.issues[0]?.path[0], 'confirmation');
  assert.match(result.error.issues[0]?.message, /не збігаються/);
});

test('registration errors distinguish duplicate email, rate limiting and CSRF', () => {
  assert.match(getRegistrationErrorMessage(400), /надійність пароля/);
  assert.match(getRegistrationErrorMessage(403), /безпеки/);
  assert.match(getRegistrationErrorMessage(409), /вже існує/);
  assert.match(getRegistrationErrorMessage(429), /Забагато/);
  assert.notEqual(getRegistrationErrorMessage(409), getRegistrationErrorMessage(429));
  assert.match(getRegistrationErrorMessage(503), /Спробуйте ще раз/);
});

test('registration success does not treat email submission as confirmed delivery', () => {
  assert.match(getRegistrationEmailMessage('SUBMITTED'), /Запит/);
  assert.match(getRegistrationEmailMessage('RETRY_REQUIRED'), /не вдався/);
  assert.notEqual(
    getRegistrationEmailMessage('SUBMITTED'),
    getRegistrationEmailMessage('RETRY_REQUIRED'),
  );
});

test('sign-up uses RHF and typed API without roles or credential persistence', async () => {
  const form = await readFile(
    new URL('../src/features/auth/ui/sign-up-form.tsx', import.meta.url),
    'utf8',
  );
  const schema = await readFile(
    new URL('../../../packages/api-client/src/generated/schema.d.ts', import.meta.url),
    'utf8',
  );
  assert.match(form, /useForm<RegistrationValues>/);
  assert.match(form, /zodResolver\(registrationSchema\)/);
  assert.match(form, /handleSubmit\(submit\)/);
  assert.match(form, /webApi.POST\('\/auth\/register'/);
  assert.match(form, /body: \{ email: values\.email, password: values\.password \}/);
  assert.match(form, /response.status !== 201/);
  assert.match(form, /data.verificationEmailStatus/);
  assert.match(form, /reset\(\)/);
  assert.doesNotMatch(form, /localStorage|sessionStorage|document.cookie/);
  assert.match(schema, /'\/auth\/register': \{/);
  assert.match(schema, /verificationEmailStatus: 'SUBMITTED' \| 'RETRY_REQUIRED'/);
});
