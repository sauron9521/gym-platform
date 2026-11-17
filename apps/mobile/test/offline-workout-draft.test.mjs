import { describe, expect, it } from 'vitest';
import { createOfflineWorkoutDraft, parseOwnedWorkoutDraft, canSendReviewedDraft } from '../src/features/workouts/lib/offline-workout-draft.ts';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const form = { title: 'Локальне тренування', exercises: [{ exerciseId: owner, sets: [{ reps: '8', weightKg: '40' }] }] };

describe('offline workout draft safety contract', () => {
  it('never exposes a valid stored draft to a different signed-in account', () => {
    const raw = JSON.stringify(createOfflineWorkoutDraft(owner, form, 1));
    expect(parseOwnedWorkoutDraft(raw, owner)?.form.title).toBe('Локальне тренування');
    expect(parseOwnedWorkoutDraft(raw, other)).toBeNull();
    expect(parseOwnedWorkoutDraft('{corrupt', owner)).toBeNull();
  });
  it('never schedules an offline or unreviewed write', () => {
    const draft = createOfflineWorkoutDraft(owner, form, 1);
    expect(canSendReviewedDraft(draft, owner, false, true)).toBe(false);
    expect(canSendReviewedDraft(draft, owner, true, false)).toBe(false);
    expect(canSendReviewedDraft(draft, other, true, true)).toBe(false);
    expect(canSendReviewedDraft(draft, owner, true, true)).toBe(true);
  });
});
