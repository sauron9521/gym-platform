import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import {
  parseAccountCapabilities,
  hasMobileAccess,
  hasAthleteAccess,
  hasTrainerAccess,
} from '../src/features/auth/model/account-capabilities.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('capability parser fails closed for untrusted or incomplete API grants', () => {
  for (const payload of [
    null,
    [],
    {},
    { athlete: true, trainer: true },
    { athlete: true, trainer: 'true', admin: false },
    { athlete: 1, trainer: true, admin: false },
    { athlete: false, trainer: false, admin: null },
  ]) {
    assert.equal(parseAccountCapabilities(payload), null);
    assert.equal(hasMobileAccess(parseAccountCapabilities(payload)), false);
    assert.equal(hasTrainerAccess(parseAccountCapabilities(payload)), false);
    assert.equal(hasAthleteAccess(parseAccountCapabilities(payload)), false);
  }
});

test('ATHLETE with approved trainer grant keeps both products, even with role ATHLETE', () => {
  const grants = parseAccountCapabilities({ athlete: true, trainer: true, admin: false });
  assert.equal(hasMobileAccess(grants), true);
  assert.equal(hasAthleteAccess(grants), true);
  assert.equal(hasTrainerAccess(grants), true);
});

test('revoked trainer and ADMIN never inherit privileges from a stale role', () => {
  const revoked = parseAccountCapabilities({ athlete: true, trainer: false, admin: false });
  assert.equal(hasAthleteAccess(revoked), true);
  assert.equal(hasTrainerAccess(revoked), false);
  const admin = parseAccountCapabilities({ athlete: false, trainer: false, admin: true });
  const inconsistent = parseAccountCapabilities({ athlete: true, trainer: true, admin: true });
  for (const grants of [admin, inconsistent]) {
    assert.equal(hasMobileAccess(grants), false);
    assert.equal(hasAthleteAccess(grants), false);
    assert.equal(hasTrainerAccess(grants), false);
  }
});

test('auth bootstraps both account and live permissions before unlocking screens', () => {
  const auth = read('../src/features/auth/model/auth-context.tsx');
  const navigation = read('../src/app/_layout.tsx');
  const tabs = read('../src/app/(tabs)/_layout.tsx');
  assert.equal((auth.match(/api\.GET\('\/users\/me\/capabilities'\)/g) ?? []).length, 4);
  assert.ok(auth.includes('setAccount(me.data)'));
  assert.ok(auth.includes('setCapabilities(grants)'));
  assert.ok(auth.includes("AppState.addEventListener('change'"));
  assert.ok(auth.includes("state === 'background'"));
  assert.ok(auth.includes("state === 'active'"));
  assert.ok(auth.includes('queryClient.clear()'));
  assert.ok(navigation.includes('guard={hasTrainerAccess(capabilities)}'));
  assert.ok(navigation.includes('guard={hasAthleteAccess(capabilities)}'));
  assert.ok(navigation.includes('guard={Boolean(account && hasMobileAccess(capabilities))}'));
  assert.ok(tabs.includes('<Tabs.Protected guard={hasAthleteAccess(capabilities)}>'));
  for (const source of [auth, navigation, tabs]) {
    assert.doesNotMatch(source, /account\??\.role\s*===?\s*['"](?:ATHLETE|TRAINER)['"]/);
  }
});
