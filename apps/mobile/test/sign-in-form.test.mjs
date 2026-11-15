import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { zodResolver } from '@hookform/resolvers/zod';

import { signInSchema } from '../src/features/auth/lib/login-flow.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Zod sign-in schema trims email but preserves the exact password', () => {
  const parsed = signInSchema.parse({
    email: '  athlete@example.test  ',
    password: '  secret pass  ',
  });
  assert.deepEqual(parsed, {
    email: 'athlete@example.test',
    password: '  secret pass  ',
  });
});

test('Zod sign-in schema rejects empty, whitespace-only and invalid input', () => {
  const invalid = signInSchema.safeParse({ email: ' not-an-email ', password: '   ' });
  assert.equal(invalid.success, false);
  assert.ok(invalid.error.issues.some((issue) => issue.path[0] === 'email'));
  assert.ok(invalid.error.issues.some((issue) => issue.path[0] === 'password'));
  assert.match(invalid.error.issues[0].message, /адресу/);

  assert.equal(signInSchema.safeParse({ email: 'valid@example.test', password: '' }).success, false);
  assert.equal(
    signInSchema.safeParse({ email: 'a'.repeat(255) + '@example.test', password: 'ok' }).success,
    false,
  );
});

test('react-hook-form Zod resolver returns field errors and normalized values', async () => {
  const resolver = zodResolver(signInSchema);
  const options = {
    criteriaMode: 'firstError',
    fields: {},
    names: ['email', 'password'],
    shouldUseNativeValidation: false,
  };
  const invalid = await resolver(
    { email: 'invalid', password: '  ' },
    undefined,
    options,
  );
  assert.match(invalid.errors.email?.message, /адресу/);
  assert.match(invalid.errors.password?.message, /пароль/);

  const valid = await resolver(
    { email: '  athlete@example.test ', password: '  secret  ' },
    undefined,
    options,
  );
  assert.deepEqual(valid.errors, {});
  assert.deepEqual(valid.values, { email: 'athlete@example.test', password: '  secret  ' });
});

test('native TextInputs use RHF Controller with accessible field and server errors', () => {
  const form = read('../src/screens/sign-in/ui/sign-in-screen.tsx');
  const context = read('../src/features/auth/model/auth-context.tsx');
  assert.match(form, /useForm<SignInValues>\(/);
  assert.match(form, /zodResolver\(signInSchema\)/);
  assert.match(form, /name="email"/);
  assert.match(form, /name="password"/);
  assert.match(form, /onChangeText=\{\(nextValue\) =>/);
  assert.match(form, /handleSubmit\(async/);
  assert.match(form, /submitLock\.current/);
  assert.match(form, /disabled=\{isSubmitting\}/);
  assert.match(form, /errors\.root\.server\.message/);
  assert.match(form, /clearErrors\('root\.server'\)/);
  assert.match(form, /accessibilityRole="alert"/);
  assert.doesNotMatch(form, /useState\(/);
  assert.doesNotMatch(form, /console\.log|password\.trim\(/);
  assert.match(context, /validateMobileCredentials\(email, password\)/);
  assert.match(context, /api\.POST\('\/auth\/token'/);
});
