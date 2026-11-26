import { z } from 'zod';

import {
  buildMobileMultiWorkoutBody,
  mobileMultiWorkoutFormSchema,
  type MobileMultiWorkoutForm,
} from './create-workout-schema';

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

// Freeze the canonical request before any network attempt. A future change to
// the body builder must explicitly migrate/reconcile these records, not
// generate a replacement key.
const submissionFields = {
  schemaVersion: z.literal(2),
  ownerId: z.uuid(),
  savedAt: z.number().int().nonnegative(),
  form: mobileMultiWorkoutFormSchema,
  key: z
    .string()
    .regex(/^draft-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
  bodyJson: z.string().max(1_000_000),
};
const pendingSchema = z.strictObject({
  ...submissionFields,
  state: z.literal('SUBMISSION_PENDING'),
});
const acknowledgedSchema = z.strictObject({
  ...submissionFields,
  state: z.literal('SUBMISSION_ACKNOWLEDGED'),
  workoutId: z.uuid(),
});
const persistedSchema = z
  .discriminatedUnion('state', [draftSchema, pendingSchema, acknowledgedSchema])
  .refine(
    (record) =>
      record.state === 'REQUIRES_REVIEW' || record.bodyJson === draftBodyJson(record.form),
  );

export type PendingWorkoutDraft = z.infer<typeof pendingSchema>;
export type AcknowledgedWorkoutDraft = z.infer<typeof acknowledgedSchema>;
export type PersistedWorkoutDraft = z.infer<typeof persistedSchema>;

export function draftBodyJson(form: MobileMultiWorkoutForm) {
  return JSON.stringify(buildMobileMultiWorkoutBody(mobileMultiWorkoutFormSchema.parse(form)));
}

export function reserveWorkoutDraft(draft: OfflineWorkoutDraft, key: string): PendingWorkoutDraft {
  return pendingSchema.parse({
    ...draft,
    schemaVersion: 2,
    state: 'SUBMISSION_PENDING',
    key,
    bodyJson: draftBodyJson(draft.form),
  });
}

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
): PersistedWorkoutDraft | null {
  // Bound parsing work for a corrupted or hostile storage record.
  if (!currentOwnerId || serialized.length > 1_000_000) return null;

  try {
    const parsed = persistedSchema.safeParse(JSON.parse(serialized));
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
  if (!currentUserId || online !== true || explicitlyConfirmed !== true) return false;
  const validated = draftSchema.safeParse(draft);
  return validated.success && validated.data.ownerId === currentUserId;
}
