import { describe, expect, it } from 'vitest';

import {
  canRegisterPushToken,
  notificationPreferencesSchema,
  parseSafePushEnvelope,
  safePushEnvelope,
} from '../src/features/notifications/lib/notification-policy.ts';

const userId = '11111111-1111-4111-8111-111111111111';
const notificationId = '22222222-2222-4222-8222-222222222222';
const enabled = {
  trainingReminders: true,
  trainerMessages: false,
  marketing: false,
};
const eligible = {
  userId,
  emailVerified: true,
  devicePermission: 'granted',
  userOptedIn: true,
  preferences: enabled,
};

describe('push notification safety contract', () => {
  it('defaults all notification categories to off and rejects unexpected preferences', () => {
    expect(notificationPreferencesSchema.parse({})).toEqual({
      trainingReminders: false,
      trainerMessages: false,
      marketing: false,
    });
    expect(notificationPreferencesSchema.safeParse({ marketing: 'true' }).success).toBe(false);
    expect(notificationPreferencesSchema.safeParse({ token: 'secret' }).success).toBe(false);
  });

  it('requires verified identity, explicit opt-in, native permission and a category', () => {
    expect(canRegisterPushToken(eligible)).toBe(true);
    expect(canRegisterPushToken({ ...eligible, userOptedIn: false })).toBe(false);
    expect(canRegisterPushToken({ ...eligible, emailVerified: false })).toBe(false);
    expect(canRegisterPushToken({ ...eligible, userId: null })).toBe(false);
    expect(canRegisterPushToken({ ...eligible, userId: 'not-a-uuid' })).toBe(false);
    expect(canRegisterPushToken({ ...eligible, devicePermission: 'denied' })).toBe(false);
    expect(canRegisterPushToken({ ...eligible, devicePermission: 'undetermined' })).toBe(false);
    expect(
      canRegisterPushToken({
        ...eligible,
        preferences: notificationPreferencesSchema.parse({}),
      }),
    ).toBe(false);
  });

  it('allows only opaque notification IDs in outgoing and incoming payloads', () => {
    const envelope = safePushEnvelope(notificationId);

    expect(envelope).toEqual({ notificationId });
    expect(parseSafePushEnvelope(envelope)).toEqual(envelope);
    expect(parseSafePushEnvelope({ ...envelope, email: 'private@example.com' })).toBeNull();
    expect(parseSafePushEnvelope({ ...envelope, title: 'Training details' })).toBeNull();
    expect(parseSafePushEnvelope({ notificationId: 'sensitive text' })).toBeNull();
    expect(parseSafePushEnvelope('bad payload')).toBeNull();
    expect(() => safePushEnvelope('private text')).toThrow();
  });
});
