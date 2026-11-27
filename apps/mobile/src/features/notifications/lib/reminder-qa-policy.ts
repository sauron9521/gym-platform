import { z } from 'zod';

const markerSchema = z.strictObject({
  version: z.literal(1),
  platform: z.enum(['android', 'ios']),
  appId: z.string().regex(/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+\.reminderqa$/),
  apiUrl: z.string(),
});

/** An internal-build marker, not an authorization grant. No UI toggle, no
 * ordinary release flag and no remote configuration enable this mode. */
export function isReminderQaEnabled(input: {
  marker: unknown;
  platform: string;
  executionEnvironment: unknown;
  configuredAppId: unknown;
  apiUrl: unknown;
}) {
  const parsed = markerSchema.safeParse(input.marker);
  if (
    !parsed.success ||
    parsed.data.platform !== input.platform ||
    !['standalone', 'bare'].includes(String(input.executionEnvironment)) ||
    parsed.data.appId !== input.configuredAppId ||
    typeof input.apiUrl !== 'string'
  )
    return false;
  try {
    const url = new URL(input.apiUrl);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.href === parsed.data.apiUrl
    );
  } catch {
    return false;
  }
}
