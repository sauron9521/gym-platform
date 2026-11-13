import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  getRegistrationEmailMessage,
  getRegistrationErrorMessage,
  validateRegistrationInput,
} from '../src/features/auth/lib/registration-flow.ts';

test('registration checks basics without changing the password', () => {
  assert.equal(validateRegistrationInput(' ', 'Password1!', 'Password1!'), 'Вкажіть електронну пошту.');
  assert.match(validateRegistrationInput('user@example.test', 'short', 'short'), /8 символів/);
  assert.match(
    validateRegistrationInput('user@example.test', 'Password1!', 'Password1?'),
    /не збігаються/,
  );
  assert.equal(validateRegistrationInput('  user@example.test  ', 'Password1!', 'Password1!'), null);
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

test('sign-up uses generated API contract without sending roles or storing tokens', async () => {
  const form = await readFile(
    new URL('../src/features/auth/ui/sign-up-form.tsx', import.meta.url),
    'utf8',
  );
  const schema = await readFile(
    new URL('../../../packages/api-client/src/generated/schema.d.ts', import.meta.url),
    'utf8',
  );

  assert.match(form, /webApi\.POST\('\/auth\/register'/);
  assert.match(form, /body: \{ email: email\.trim\(\), password \}/);
  assert.match(form, /response\.status !== 201/);
  assert.match(form, /data\.verificationEmailStatus/);
  assert.doesNotMatch(form, /localStorage|sessionStorage|document\.cookie/);
  assert.match(schema, /'\/auth\/register': \{/);
  assert.match(schema, /verificationEmailStatus: 'SUBMITTED' \| 'RETRY_REQUIRED'/);
});
