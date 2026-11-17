import { z } from 'zod';
import { mobileMultiWorkoutFormSchema, type MobileMultiWorkoutForm } from './create-workout-schema';

/**
 * Storage-neutral draft contract. This is NOT an offline write queue:
 * a future SQLite adapter must never automatically replay writes.
 */
const draftSchema = z.object({
  ownerId: z.uuid(),
  savedAt: z.number().int().nonnegative(),
  form: mobileMultiWorkoutFormSchema,
  state: z.literal('REQUIRES_REVIEW'),
}).strict();

export type OfflineWorkoutDraft = z.infer<typeof draftSchema>;

export function createOfflineWorkoutDraft(
  ownerId: string,
  form: MobileMultiWorkoutForm,
  now = Date.now(),
): OfflineWorkoutDraft {
  return draftSchema.parse({ ownerId, savedAt: now, form, state: 'REQUIRES_REVIEW' });
}

/** Reject corrupt or cross-account data before it reaches React Query or the UI. */
export function parseOwnedWorkoutDraft(serialized: string, ownerId: string): OfflineWorkoutDraft | null {
  try {
    const parsed = draftSchema.safeParse(JSON.parse(serialized));
    if (!parsed.success || parsed.data.ownerId !== ownerId) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/** Manual user confirmation must gate every eventual replay; do not infer it from connectivity. */
export function canSendReviewedDraft(
  draft: OfflineWorkoutDraft,
  currentUserId: string | null,
  online: boolean,
  explicitlyConfirmed: boolean,
): boolean {
  return Boolean(
    currentUserId &&
    draft.ownerId === currentUserId &&
    draft.state === 'REQUIRES_REVIEW' &&
    online &&
    explicitlyConfirmed,
  );
}
