import {
  defaultNotificationSettings as defaults,
  defaultNotificationPreferences,
  notificationSettingsSchema,
  notificationSettingsPatchSchema,
  notificationConsentEnabled,
  mergeNotificationSettings,
  quietHoursAt,
  localReminderCandidate,
} from '../domain/notification-settings.policy.js';
import { isIanaTimezone } from '@gym/datetime';

describe('notification preferences', () => {
  it('defaults every external pair off with a 22–08 quiet window and one hour lead', () => {
    expect(defaults).toEqual({
      quietHoursEnabled: true,
      quietStartMinute: 1320,
      quietEndMinute: 480,
      reminderLeadMinutes: 60,
    });
    expect(defaultNotificationPreferences).toHaveLength(4);
    expect(defaultNotificationPreferences.every((p) => !notificationConsentEnabled(p))).toBe(true);
    expect(notificationConsentEnabled(undefined)).toBe(false);
    expect(
      notificationConsentEnabled({ category: 'TRAINER', channel: 'MOBILE_PUSH', enabled: true }),
    ).toBe(true);
    expect(
      notificationConsentEnabled({ category: 'MARKETING', channel: 'EMAIL', enabled: true }),
    ).toBe(false);
  });

  it.each([
    {},
    { userId: 'other' },
    { timezone: 'UTC' },
    { reminderLeadMinutes: 30 },
    { reminderLeadMinutes: '60' },
    { quietStartMinute: -1 },
    { quietEndMinute: 1440 },
    { quietHoursEnabled: null },
    { preferences: [] },
    { preferences: [{ category: 'WORKOUT', channel: 'MOBILE_PUSH', enabled: true }] },
    { preferences: [{ category: 'ADMIN', channel: 'EMAIL', enabled: true }] },
    { preferences: [{ category: 'ACCOUNT', channel: 'EMAIL', enabled: true, consentedAt: 'now' }] },
    {
      preferences: [
        { category: 'ACCOUNT', channel: 'EMAIL', enabled: true },
        { category: 'ACCOUNT', channel: 'EMAIL', enabled: false },
      ],
    },
  ])('rejects invalid/unknown/nonexplicit patch %j', (input) => {
    expect(notificationSettingsPatchSchema.safeParse(input).success).toBe(false);
  });

  it('merges only provided fields and validates the resulting window, including explicit false', () => {
    expect(
      mergeNotificationSettings(defaults, { quietHoursEnabled: false, reminderLeadMinutes: 15 }),
    ).toEqual({
      ...defaults,
      quietHoursEnabled: false,
      reminderLeadMinutes: 15,
    });
    expect(
      mergeNotificationSettings(defaults, {
        preferences: [{ category: 'TRAINER', channel: 'MOBILE_PUSH', enabled: false }],
      }),
    ).toEqual(defaults);
    expect(() => mergeNotificationSettings(defaults, { quietStartMinute: 480 })).toThrow();
    expect(
      notificationSettingsSchema.safeParse({ ...defaults, quietStartMinute: 480 }).success,
    ).toBe(false);
  });
});

describe('quiet hours at a real instant', () => {
  const at = (iso: string, timezone: string = 'UTC', settings = defaults) =>
    quietHoursAt(new Date(iso), timezone, settings);
  it.each([
    ['2026-11-26T21:59:59Z', 'allowed'],
    ['2026-11-26T22:00:00Z', 'quiet'],
    ['2026-11-27T00:00:00Z', 'quiet'],
    ['2026-11-27T07:59:59Z', 'quiet'],
    ['2026-11-27T08:00:00Z', 'allowed'],
  ])('applies inclusive start and exclusive end across midnight: %s', (instant, expected) => {
    expect(at(instant)).toBe(expected);
  });
  it('handles same-day quiet hours, disabled window and canonical timezone', () => {
    const midday = { ...defaults, quietStartMinute: 720, quietEndMinute: 780 };
    expect(at('2026-11-26T12:00:00Z', 'UTC', midday)).toBe('quiet');
    expect(at('2026-11-26T13:00:00Z', 'UTC', midday)).toBe('allowed');
    expect(at('2026-11-26T20:00:00Z', 'Europe/Kyiv')).toBe('quiet');
    expect(at('2026-11-26T20:00:00Z', 'UTC')).toBe('allowed');
    expect(at('2026-11-26T23:00:00Z', 'UTC', { ...defaults, quietHoursEnabled: false })).toBe(
      'allowed',
    );
  });
  it('classifies both repeated DST minutes identically and skips nonexistent local times', () => {
    const window = { ...defaults, quietStartMinute: 60, quietEndMinute: 180 };
    expect(at('2026-11-01T05:30:00Z', 'America/New_York', window)).toBe('quiet');
    expect(at('2026-11-01T06:30:00Z', 'America/New_York', window)).toBe('quiet');
    expect(at('2026-03-08T06:59:00Z', 'America/New_York', window)).toBe('quiet');
    expect(at('2026-03-08T07:00:00Z', 'America/New_York', window)).toBe('allowed');
  });
  it('projects non-hour offsets and a midnight DST gap without using the process timezone', () => {
    const midday = { ...defaults, quietStartMinute: 720, quietEndMinute: 780 };
    expect(at('2026-11-27T06:15:00Z', 'Asia/Kathmandu', midday)).toBe('quiet');
    expect(at('2026-11-27T07:15:00Z', 'Asia/Kathmandu', midday)).toBe('allowed');
    const midnight = { ...defaults, quietStartMinute: 0, quietEndMinute: 60 };
    expect(at('2018-11-04T03:00:00Z', 'America/Sao_Paulo', midnight)).toBe('allowed');
  });
  it('fails closed for invalid dates, timezone, offsets or settings even if disabled', () => {
    for (const zone of ['Mars/Olympus', '+02:00', 'EST', '', undefined])
      expect(isIanaTimezone(zone)).toBe(false);
    expect(at('invalid')).toBe('invalid');
    expect(at('2026-11-26T12:00:00Z', 'invalid', { ...defaults, quietHoursEnabled: false })).toBe(
      'invalid',
    );
    expect(at('2026-11-26T12:00:00Z', 'UTC', { ...defaults, quietEndMinute: 1320 })).toBe(
      'invalid',
    );
    expect(isIanaTimezone('Europe/Kyiv')).toBe(true);
  });
});

describe('local reminder candidate (no scheduling)', () => {
  const input = {
    status: 'PLANNED',
    scheduledAt: new Date('2026-11-27T16:00:00Z'),
    now: new Date('2026-11-27T12:00:00Z'),
    timezone: 'UTC',
    settings: defaults,
    consent: { category: 'WORKOUT', channel: 'LOCAL_REMINDER', enabled: true },
  };
  it('uses one absolute lead and rejects expired or quiet reminders without moving them', () => {
    expect(localReminderCandidate(input)?.toISOString()).toBe('2026-11-27T15:00:00.000Z');
    expect(
      localReminderCandidate({
        ...input,
        settings: { ...defaults, reminderLeadMinutes: 15 },
      })?.toISOString(),
    ).toBe('2026-11-27T15:45:00.000Z');
    expect(
      localReminderCandidate({ ...input, settings: { ...defaults, reminderLeadMinutes: 1440 } }),
    ).toBeNull();
    expect(localReminderCandidate({ ...input, now: new Date('2026-11-27T15:00:00Z') })).toBeNull();
    expect(
      localReminderCandidate({ ...input, scheduledAt: new Date('2026-11-28T08:30:00Z') }),
    ).toBeNull();
  });
  it.each([
    ['2026-03-29T12:00:00Z', '2026-03-28T12:00:00.000Z'],
    ['2026-10-25T12:00:00Z', '2026-10-24T12:00:00.000Z'],
  ])('uses 1440 elapsed minutes across DST, not one civil day: %s', (scheduled, expected) => {
    expect(
      localReminderCandidate({
        ...input,
        scheduledAt: new Date(scheduled),
        now: new Date('2026-03-01T00:00:00Z'),
        timezone: 'Europe/Kyiv',
        settings: { ...defaults, reminderLeadMinutes: 1440, quietHoursEnabled: false },
      })?.toISOString(),
    ).toBe(expected);
  });
  it('never grants permission or accepts a wrong category, nonplanned state or invalid input', () => {
    for (const status of ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
      expect(localReminderCandidate({ ...input, status })).toBeNull();
    expect(
      localReminderCandidate({ ...input, consent: { ...input.consent, enabled: false } }),
    ).toBeNull();
    expect(
      localReminderCandidate({
        ...input,
        consent: { category: 'TRAINER', channel: 'MOBILE_PUSH', enabled: true },
      }),
    ).toBeNull();
    expect(localReminderCandidate({ ...input, timezone: 'invalid' })).toBeNull();
    expect(localReminderCandidate({ ...input, now: new Date(NaN) })).toBeNull();
    expect(localReminderCandidate({ ...input, scheduledAt: new Date(NaN) })).toBeNull();
    expect(
      localReminderCandidate({ ...input, settings: { ...defaults, quietStartMinute: 480 } }),
    ).toBeNull();
  });
});
