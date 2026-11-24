import { z } from 'zod';

/**
 * These are user preferences only. They do not request native permission,
 * register a device or enable push delivery.
 */
export const notificationPreferencesSchema = z.strictObject({
  trainingReminders: z.boolean().default(false),
  trainerMessages: z.boolean().default(false),
  marketing: z.boolean().default(false),
});

type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

type PushRegistrationContext = {
  userId: string | null;
  emailVerified: boolean;
  devicePermission: 'granted' | 'denied' | 'undetermined';
  userOptedIn: boolean;
  preferences: NotificationPreferences;
};

/**
 * Eligibility only, never a push token registration.
 * The server must independently check user identity, consent and token ownership.
 */
export function canRegisterPushToken(context: PushRegistrationContext): boolean {
  if (!context.userOptedIn || !context.emailVerified) return false;
  if (context.devicePermission !== 'granted') return false;
  if (!z.uuid().safeParse(context.userId).success) return false;

  const parsed = notificationPreferencesSchema.safeParse(context.preferences);
  return parsed.success && Object.values(parsed.data).some((enabled) => enabled);
}

/** Only an opaque notification ID can cross the push transport boundary. */
const pushEnvelopeSchema = z.strictObject({
  notificationId: z.uuid(),
});

export type SafePushEnvelope = z.infer<typeof pushEnvelopeSchema>;

export function safePushEnvelope(notificationId: string): SafePushEnvelope {
  return pushEnvelopeSchema.parse({ notificationId });
}

/** Validate received data too: reject private text and unknown fields. */
export function parseSafePushEnvelope(value: unknown): SafePushEnvelope | null {
  const parsed = pushEnvelopeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
