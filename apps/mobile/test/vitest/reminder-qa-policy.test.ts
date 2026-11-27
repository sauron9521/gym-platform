import { describe, expect, it } from 'vitest';
import { isReminderQaEnabled } from '@/features/notifications/lib/reminder-qa-policy';

const marker = {
  version: 1,
  platform: 'android',
  appId: 'app.example.reminderqa',
  apiUrl: 'https://staging.example.test/api',
};
const input = {
  marker,
  platform: 'android',
  executionEnvironment: 'standalone',
  configuredAppId: marker.appId,
  apiUrl: marker.apiUrl,
};

describe('reminder QA runtime gate', () => {
  it('admits only matching native internal configuration', () => {
    expect(isReminderQaEnabled(input)).toBe(true);
    expect(
      isReminderQaEnabled({
        ...input,
        platform: 'ios',
        marker: { ...marker, platform: 'ios' },
        executionEnvironment: 'bare',
      }),
    ).toBe(true);
  });
  it('fails closed on ordinary, web, Expo Go, malformed or mismatched config', () => {
    for (const change of [
      { marker: undefined },
      { marker: true },
      { marker: { ...marker, version: 2 } },
      { marker: { ...marker, unknown: true } },
      { platform: 'web' },
      { platform: 'ios' },
      { executionEnvironment: 'storeClient' },
      { executionEnvironment: null },
      { configuredAppId: 'app.example.production' },
      { configuredAppId: undefined },
      { apiUrl: undefined },
      { apiUrl: 'http://staging.example.test/api' },
      { apiUrl: 'https://production.example.test/api' },
      { apiUrl: 'https://staging.example.test/api?x=1' },
    ])
      expect(isReminderQaEnabled({ ...input, ...change })).toBe(false);
  });
});
