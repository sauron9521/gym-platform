import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'vitest';

import { getMessages } from '@gym/i18n';

import {
  getResendErrorKey,
  getVerificationErrorKey,
  getVerificationToken,
} from '../src/features/auth/lib/email-verification-flow.ts';

test('verification tokens must be non-empty strings of bounded length', () => {
  assert.equal(getVerificationToken('opaque-token'), 'opaque-token');
  for (const value of [undefined, null, '', ['token'], 1, 'a'.repeat(2049)]) {
    assert.equal(getVerificationToken(value), null);
  }
  assert.equal(getVerificationToken('a'.repeat(2048)), 'a'.repeat(2048));
});

test('verification localizes status-only errors for both supported languages', () => {
  for (const [status, key] of [
    [400, 'invalidToken'],
    [403, 'forbidden'],
    [429, 'rateLimited'],
    [503, 'verificationFailed'],
  ]) {
    assert.equal(getVerificationErrorKey(status), key);
    for (const locale of ['uk', 'en']) {
      assert.ok(getMessages(locale).web.verification[key]);
    }
  }
});

test('resend handles auth, already-verified, rate-limit and mail failures', () => {
  for (const [status, key] of [
    [401, 'signInRequired'],
    [403, 'forbidden'],
    [409, 'alreadyVerified'],
    [429, 'resendRateLimited'],
    [503, 'mailUnavailable'],
    [500, 'resendFailed'],
  ]) {
    assert.equal(getResendErrorKey(status), key);
    for (const locale of ['uk', 'en']) {
      assert.ok(getMessages(locale).web.verification[key]);
    }
  }
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
  assert.match(page, /getTranslations\('web\.verification'\)/);
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
  assert.match(app, /getTranslations\('web\.verification'\)/);
  assert.match(contract, /'\/auth\/email\/verification': \{/);
  assert.match(contract, /EmailVerificationController_resend:/);
  assert.doesNotMatch(component, /name="email"|body:.*email|localStorage|sessionStorage/);
  assert.match(component, /getResendErrorKey\(response\.status\)/);
  assert.doesNotMatch(component, /response\.data\.message/);
});
