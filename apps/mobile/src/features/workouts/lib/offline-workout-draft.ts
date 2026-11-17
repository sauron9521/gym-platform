import { z } from 'zod';

import { mobileMultiWorkoutFormSchema, type MobileMultiWorkoutForm } from './create-workout-schema';

/**
 * Storage-neutral, versioned draft contract for a future offline adapter.
 *
 * This file does not persist data, schedule mutations, or automatically replay
 * anything. Persisted data is untrusted and must be account-validated on read.
 */
const draftSchema = z.strictObject({
  schemaVersion: z.literal(1),
  ownerId: z.uuid(),
  savedAt: z.number().int().nonnegative(),
  form: mobileMultiWorkoutFormSchema,
  state: z.literal('REQUIRES_REVIEW'),
});

export type OfflineWorkoutDraft = z.infer<typeof draftSchema>;

export function createOfflineWorkoutDraft(
  ownerId: string,
  form: MobileMultiWorkoutForm,
  now = Date.now(),
): OfflineWorkoutDraft {
  return draftSchema.parse({
    schemaVersion: 1,
    ownerId,
    savedAt: now,
    form,
    state: 'REQUIRES_REVIEW',
  });
}

/** Never return another account's data, corrupt JSON or an unknown schema version. */
export function parseOwnedWorkoutDraft(
  serialized: string,
  currentOwnerId: string,
): OfflineWorkoutDraft | null {
  // Bound parsing work for a corrupted or hostile storage record.
  if (!currentOwnerId || serialized.length > 1_000_000) return null;

  try {
    const parsed = draftSchema.safeParse(JSON.parse(serialized));
    if (!parsed.success || parsed.data.ownerId !== currentOwnerId) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * Eligibility check, NOT a send operation or permission grant.
 * A future adapter must require a fresh, explicit review and server validation
 * before attempting any network mutation; connectivity alone is insufficient.
 */
export function canSendReviewedDraft(
  draft: OfflineWorkoutDraft,
  currentUserId: string | null,
  online: boolean,
  explicitlyConfirmed: boolean,
): boolean {
  if (!currentUserId || !online || !explicitlyConfirmed) return false;
  const validated = draftSchema.safeParse(draft);
  return validated.success && validated.data.ownerId === currentUserId;
}
