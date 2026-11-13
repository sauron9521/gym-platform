import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  getResendErrorMessage,
  getVerificationErrorMessage,
  getVerificationToken,
} from '../src/features/auth/lib/email-verification-flow.ts';

test('verification tokens must be non-empty strings of bounded length', () => {
  assert.equal(getVerificationToken('opaque-token'), 'opaque-token');
  for (const value of [undefined, null, '', ['token'], 1, 'a'.repeat(2049)]) {
    assert.equal(getVerificationToken(value), null);
  }
  assert.equal(getVerificationToken('a'.repeat(2048)), 'a'.repeat(2048));
});

test('verification rejects expired, reused, malformed links and throttling', () => {
  assert.match(getVerificationErrorMessage(400), /недійсне/);
  assert.match(getVerificationErrorMessage(403), /безпеки/);
  assert.match(getVerificationErrorMessage(429), /Забагато/);
  assert.match(getVerificationErrorMessage(503), /Спробуйте/);
});

test('resend requires an authenticated account and handles all API statuses', () => {
  assert.match(getResendErrorMessage(401), /Увійдіть/);
  assert.match(getResendErrorMessage(403), /безпеки/);
  assert.match(getResendErrorMessage(409), /вже підтверджена/);
  assert.match(getResendErrorMessage(429), /Забагато/);
  assert.match(getResendErrorMessage(503), /тимчасово недоступний/);
});

test('verification only consumes email token after explicit user action', async () => {
  const component = await readFile(
    new URL('../src/features/auth/ui/verify-email-form.tsx', import.meta.url),
    'utf8',
  );
  const page = await readFile(new URL('../src/app/verify-email/page.tsx', import.meta.url), 'utf8');
  const backend = await readFile(new URL('../../api/src/app.module.ts', import.meta.url), 'utf8');
  const contract = await readFile(
    new URL('../../../packages/api-client/src/generated/schema.d.ts', import.meta.url),
    'utf8',
  );

  assert.match(backend, /APP_URL.*verify-email/);
  assert.match(page, /searchParams: Promise/);
  assert.match(page, /getVerificationToken\(rawToken\)/);
  assert.match(page, /referrer: 'no-referrer'/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(component, /window\.history\.replaceState/);
  assert.match(component, /onClick=\{handleVerify\}/);
  assert.match(component, /webApi\.POST\('\/auth\/email\/verify'/);
  assert.match(component, /body: \{ token \}/);
  assert.match(component, /response\.status !== 200/);
  assert.match(contract, /'\/auth\/email\/verify': \{/);
  assert.match(
    contract,
    /EmailVerificationController_verifyEmail: \{[\s\S]*?requestBody: \{[\s\S]*?'application\/json': \{\s*token: string;/,
  );
  assert.doesNotMatch(component, /localStorage|sessionStorage|console\.log|document\.cookie/);
  const effectBody = component.slice(
    component.indexOf('useEffect(() => {'),
    component.indexOf('}, []);'),
  );
  assert.doesNotMatch(effectBody, /webApi\.POST/);
});

test('resend uses only authenticated cookie session and never asks for arbitrary email', async () => {
  const component = await readFile(
    new URL('../src/features/auth/ui/resend-verification-form.tsx', import.meta.url),
    'utf8',
  );
  const contract = await readFile(
    new URL('../../../packages/api-client/src/generated/schema.d.ts', import.meta.url),
    'utf8',
  );
  const app = await readFile(
    new URL('../src/app/verify-email/resend/page.tsx', import.meta.url),
    'utf8',
  );

  assert.match(component, /onClick=\{handleResend\}/);
  assert.match(component, /webApi\.POST\('\/auth\/email\/verification'\)/);
  assert.match(component, /response\.status !== 202/);
  assert.match(component, /state === 'submitted'/);
  assert.match(component, /href="\/login"/);
  assert.match(app, /robots: \{ index: false, follow: false \}/);
  assert.match(contract, /'\/auth\/email\/verification': \{/);
  assert.match(contract, /EmailVerificationController_resend:/);
  assert.doesNotMatch(component, /name="email"|body:.*email|localStorage|sessionStorage/);
});
