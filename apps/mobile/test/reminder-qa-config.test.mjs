import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'vitest';
import { validateMobileReleaseChannels } from '../scripts/release-channel-preflight.mjs';

const require = createRequire(import.meta.url);
const { resolveAppConfig } = require('../app.config.js');
const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
const fixture = {
  EAS_BUILD_PROFILE: 'reminder-qa',
  OVRANTO_REMINDER_QA: '1',
  OVRANTO_REMINDER_QA_PLATFORM: 'android',
  EAS_BUILD_PLATFORM: 'android',
  EXPO_PUBLIC_API_URL: 'https://staging.example.test/api',
  OVRANTO_REMINDER_QA_API_URL: 'https://staging.example.test/api',
  OVRANTO_PRODUCTION_API_URL: 'https://production.example.test/api',
  OVRANTO_REMINDER_QA_APP_ID: 'app.example.reminderqa',
};

test('ordinary build profiles cannot inherit or inject the QA marker', () => {
  for (const profile of [undefined, 'development', 'preview', 'production']) {
    const config = resolveAppConfig(
      { ...app, extra: { eas: { projectId: 'fixture' }, reminderQa: { version: 1 } } },
      { EAS_BUILD_PROFILE: profile },
    );
    assert.equal(config.extra.reminderQa, undefined);
    assert.deepEqual(config.extra.eas, { projectId: 'fixture' });
    assert.equal(config.name, app.name);
    assert.throws(
      () => resolveAppConfig(app, { ...fixture, EAS_BUILD_PROFILE: profile }),
      /dedicated EAS profile/,
    );
  }
});

test('QA config requires explicit isolated platform identity and matching staging endpoint', () => {
  for (const platform of ['android', 'ios']) {
    const config = resolveAppConfig(app, {
      ...fixture,
      OVRANTO_REMINDER_QA_PLATFORM: platform,
      EAS_BUILD_PLATFORM: platform,
    });
    assert.equal(config.name, 'OVRANTO Reminder QA');
    assert.equal(config.scheme, 'gymplatform-reminder-qa');
    assert.equal(config.updates.enabled, false);
    assert.equal(
      platform === 'android' ? config.android.package : config.ios.bundleIdentifier,
      fixture.OVRANTO_REMINDER_QA_APP_ID,
    );
    assert.deepEqual(config.extra.reminderQa, {
      version: 1,
      platform,
      appId: fixture.OVRANTO_REMINDER_QA_APP_ID,
      apiUrl: fixture.EXPO_PUBLIC_API_URL,
    });
    assert.deepEqual(config.plugins, app.plugins);
  }
  assert.throws(() => resolveAppConfig(app, { ...fixture, OVRANTO_REMINDER_QA: '0' }), /opt-in/);
  assert.throws(
    () => resolveAppConfig(app, { ...fixture, EAS_BUILD_PLATFORM: 'ios' }),
    /matching native/,
  );
  assert.throws(
    () => resolveAppConfig(app, { ...fixture, OVRANTO_REMINDER_QA_PLATFORM: 'web' }),
    /matching native/,
  );
  assert.throws(
    () =>
      resolveAppConfig(app, { ...fixture, OVRANTO_REMINDER_QA_APP_ID: 'app.example.production' }),
    /separate native QA app ID/,
  );
  assert.throws(
    () =>
      resolveAppConfig(
        { ...app, android: { package: fixture.OVRANTO_REMINDER_QA_APP_ID } },
        fixture,
      ),
    /separate native QA app ID/,
  );
});

test('QA refuses missing, non-HTTPS, mismatched or production-origin targets', () => {
  for (const url of [
    undefined,
    'http://staging.example.test/api',
    'https://user:pass@staging.example.test/api',
    'https://staging.example.test/api?secret=x',
    'https://localhost/api',
    'https://127.0.0.1/api',
    'https://other.example.test/api',
    'https://production.example.test/api',
  ]) {
    assert.throws(
      () => resolveAppConfig(app, { ...fixture, EXPO_PUBLIC_API_URL: url }),
      /approved HTTPS staging API/,
    );
  }
  assert.throws(
    () =>
      resolveAppConfig(app, {
        ...fixture,
        OVRANTO_PRODUCTION_API_URL: 'https://staging.example.test/other',
      }),
    /distinct from production/,
  );
  assert.throws(
    () => resolveAppConfig(app, { ...fixture, OVRANTO_PRODUCTION_API_URL: undefined }),
    /distinct from production/,
  );
});

test('release channel checks reject QA leakage, unsafe distribution and profile inheritance', () => {
  assert.deepEqual(validateMobileReleaseChannels(eas), []);
  for (const mutate of [
    (x) => {
      x.build.production.env = { OVRANTO_REMINDER_QA: '1' };
    },
    (x) => {
      x.build.production.extends = 'reminder-qa';
    },
    (x) => {
      x.build['reminder-qa'].environment = 'production';
    },
    (x) => {
      x.build['reminder-qa'].channel = 'preview';
    },
    (x) => {
      x.build['reminder-qa'].distribution = 'store';
    },
    (x) => {
      x.build['reminder-qa'].android.buildType = 'app-bundle';
    },
    (x) => {
      x.build['reminder-qa'].extends = 'preview';
    },
    (x) => {
      delete x.build['reminder-qa'];
    },
  ]) {
    const unsafe = structuredClone(eas);
    mutate(unsafe);
    assert.ok(validateMobileReleaseChannels(unsafe).length > 0);
  }
});

test('QA mode smoke uses existing auth/settings selectors without fabricating permission or delivery evidence', () => {
  const flow = readFileSync(
    new URL('../maestro/flows/reminder-qa-mode-smoke.yaml', import.meta.url),
    'utf8',
  );
  for (const selector of [
    'sign-in-email',
    'sign-in-password',
    'mobile-tab-profile',
    'profile-app-settings',
    'notification-reminder-qa-mode',
    'notification-consent-WORKOUT',
  ])
    assert.ok(flow.includes('id: ' + selector));
  assert.ok(flow.includes('appId: ${APP_ID}'));
  assert.ok(flow.includes('${E2E_EMAIL}') && flow.includes('${E2E_PASSWORD}'));
  assert.doesNotMatch(
    flow,
    /clearState|permissions:|setPermissions|tapOn:.*notification-consent|sleep:|@example\.com|password123/,
  );
});
