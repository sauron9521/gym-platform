import { z } from 'zod';

/** No push registration without explicit per-device opt-in and platform consent. */
export const notificationPreferencesSchema = z.object({
  trainingReminders: z.boolean().default(false),
  trainerMessages: z.boolean().default(false),
  marketing: z.boolean().default(false),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export function canRegisterPushToken({
  userId,
  devicePermission,
  userOptedIn,
}: {
  userId: string | null;
  devicePermission: 'granted' | 'denied' | 'undetermined';
  userOptedIn: boolean;
}): boolean {
  return Boolean(userId && userOptedIn && devicePermission === 'granted');
}

/**
 * Push payloads should carry only opaque notification IDs, never names,
 * workout results, emails, access tokens or sensitive user information.
 */
export function safePushEnvelope(notificationId: string): { notificationId: string } {
  return { notificationId: z.uuid().parse(notificationId) };
}
