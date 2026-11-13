import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  getForgotPasswordErrorMessage,
  getPasswordResetToken,
  getResetPasswordErrorMessage,
  validatePasswordResetInput,
} from '../src/features/auth/lib/password-reset-flow.ts';

test('password reset requires matching non-empty, minimum-length passwords', () => {
  assert.match(validatePasswordResetInput('short', 'short'), /8 символів/);
  assert.match(validatePasswordResetInput('        ', '        '), /пробілів/);
  assert.match(validatePasswordResetInput('StrongPassword123!', 'DifferentPassword123!'), /не збігаються/);
  assert.equal(validatePasswordResetInput('StrongPassword123!', 'StrongPassword123!'), null);
});

test('recovery token parsing rejects arrays, missing data and oversized tokens', () => {
  assert.equal(getPasswordResetToken('opaque-token'), 'opaque-token');
  for (const value of [undefined, null, '', ['one', 'two'], 123, 'a'.repeat(2049)]) {
    assert.equal(getPasswordResetToken(value), null);
  }
  assert.equal(getPasswordResetToken('a'.repeat(2048)), 'a'.repeat(2048));
});

test('forgot-password errors do not disclose account existence', () => {
  assert.match(getForgotPasswordErrorMessage(400), /електронної адреси/);
  assert.match(getForgotPasswordErrorMessage(403), /безпеки/);
  assert.match(getForgotPasswordErrorMessage(429), /Забагато/);
  assert.match(getForgotPasswordErrorMessage(503), /Спробуйте/);
  assert.doesNotMatch(
    Object.values([400, 403, 429, 503]).map(getForgotPasswordErrorMessage).join(' '),
    /існує|зареєстрован|невідомий користувач/i,
  );
});

test('reset handles invalid or expired tokens without leaking response details', () => {
  assert.match(getResetPasswordErrorMessage(400), /недійсне/);
  assert.match(getResetPasswordErrorMessage(403), /безпеки/);
  assert.match(getResetPasswordErrorMessage(429), /Забагато/);
  assert.match(getResetPasswordErrorMessage(503), /Спробуйте/);
});

test('forgot request follows actual 202-only OpenAPI contract with generic success state', async () => {
  const ui = await readFile(
    new URL('../src/features/auth/ui/forgot-password-form.tsx', import.meta.url),
    'utf8',
  );
  const contract = await readFile(
    new URL('../../../packages/api-client/src/generated/schema.d.ts', import.meta.url),
    'utf8',
  );
  assert.match(ui, /webApi\.POST\('\/auth\/password-reset\/forgot'/);
  assert.match(ui, /body: \{ email: email\.trim\(\) \}/);
  assert.match(ui, /response\.status !== 202/);
  assert.match(ui, /Якщо обліковий запис із такою адресою існує/);
  assert.doesNotMatch(ui, /response\.json\(|localStorage|sessionStorage|console\.log|document\.cookie/);
  assert.match(contract, /'\/auth\/password-reset\/forgot': \{/);
  assert.match(contract, /PasswordResetController_forgot: \{/);
});

test('reset requires explicit form submit, removes query token and never grants access from 200 alone', async () => {
  const ui = await readFile(
    new URL('../src/features/auth/ui/reset-password-form.tsx', import.meta.url),
    'utf8',
  );
  const page = await readFile(new URL('../src/app/reset-password/page.tsx', import.meta.url), 'utf8');
  const backend = await readFile(new URL('../../api/src/app.module.ts', import.meta.url), 'utf8');
  const contract = await readFile(
    new URL('../../../packages/api-client/src/generated/schema.d.ts', import.meta.url),
    'utf8',
  );
  assert.match(backend, /APP_URL.*reset-password/);
  assert.match(page, /searchParams: Promise/);
  assert.match(page, /getPasswordResetToken\(rawToken\)/);
  assert.match(page, /referrer: 'no-referrer'/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(ui, /window\.history\.replaceState/);
  assert.match(ui, /onSubmit=\{handleSubmit\}/);
  assert.match(ui, /webApi\.POST\('\/auth\/password-reset\/reset'/);
  assert.match(ui, /body: \{ token, password \}/);
  assert.match(ui, /response\.status !== 200/);
  assert.match(ui, /setPassword\(''\)/);
  assert.match(ui, /setConfirmation\(''\)/);
  assert.match(contract, /'\/auth\/password-reset\/reset': \{/);
  assert.match(contract, /PasswordResetController_reset: \{/);
  assert.doesNotMatch(ui, /router\.replace\('\/dashboard'\)|localStorage|sessionStorage|console\.log|document\.cookie/);
  const effect = ui.slice(ui.indexOf('useEffect(() => {'), ui.indexOf('}, []);'));
  assert.doesNotMatch(effect, /webApi\.POST/);
});
