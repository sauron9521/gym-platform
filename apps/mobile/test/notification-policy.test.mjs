import { test, expect } from 'vitest';
import { canRegisterPushToken, notificationPreferencesSchema, safePushEnvelope } from '../src/features/notifications/lib/notification-policy.ts';

test('push opt-in is denied by default even with platform permission', () => {
  expect(notificationPreferencesSchema.parse({})).toEqual({ trainingReminders: false, trainerMessages: false, marketing: false });
  expect(canRegisterPushToken({ userId: 'user', devicePermission: 'granted', userOptedIn: false })).toBe(false);
  expect(canRegisterPushToken({ userId: null, devicePermission: 'granted', userOptedIn: true })).toBe(false);
  expect(canRegisterPushToken({ userId: 'user', devicePermission: 'denied', userOptedIn: true })).toBe(false);
  expect(canRegisterPushToken({ userId: 'user', devicePermission: 'granted', userOptedIn: true })).toBe(true);
});
test('transport notification envelope never embeds private message text', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  expect(safePushEnvelope(id)).toEqual({ notificationId: id });
  expect(() => safePushEnvelope('sensitive email')).toThrow();
});
