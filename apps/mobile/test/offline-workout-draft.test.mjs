import { describe, expect, it } from 'vitest';

import {
  canSendReviewedDraft,
  createOfflineWorkoutDraft,
  parseOwnedWorkoutDraft,
} from '../src/features/workouts/lib/offline-workout-draft.ts';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const exercise = '33333333-3333-4333-8333-333333333333';
const form = {
  title: 'Локальне тренування',
  exercises: [{ exerciseId: exercise, sets: [{ reps: '8', weightKg: '40' }] }],
};

describe('offline workout draft safety contract', () => {
  it('creates a versioned draft that is readable only by its owner', () => {
    const draft = createOfflineWorkoutDraft(owner, form, 123);
    const serialized = JSON.stringify(draft);

    expect(draft.schemaVersion).toBe(1);
    expect(draft.state).toBe('REQUIRES_REVIEW');
    expect(parseOwnedWorkoutDraft(serialized, owner)).toEqual(draft);
    expect(parseOwnedWorkoutDraft(serialized, other)).toBeNull();
    expect(parseOwnedWorkoutDraft(serialized, '')).toBeNull();
  });

  it('rejects corrupt, unsupported-version and oversized stored data', () => {
    const draft = createOfflineWorkoutDraft(owner, form, 123);
    const unsupported = JSON.stringify({ ...draft, schemaVersion: 2 });
    const badTimestamp = JSON.stringify({ ...draft, savedAt: -1 });
    const badState = JSON.stringify({ ...draft, state: 'READY' });
    const extraField = JSON.stringify({ ...draft, token: 'secret' });

    expect(parseOwnedWorkoutDraft('{corrupt', owner)).toBeNull();
    expect(parseOwnedWorkoutDraft(unsupported, owner)).toBeNull();
    expect(parseOwnedWorkoutDraft(badTimestamp, owner)).toBeNull();
    expect(parseOwnedWorkoutDraft(badState, owner)).toBeNull();
    expect(parseOwnedWorkoutDraft(extraField, owner)).toBeNull();
    expect(parseOwnedWorkoutDraft(' '.repeat(1_000_001), owner)).toBeNull();
  });

  it('validates nested exercise and set limits before storing or restoring', () => {
    const draft = createOfflineWorkoutDraft(owner, form, 123);
    const emptyExercises = {
      ...draft,
      form: { ...form, exercises: [] },
    };
    const invalidReps = {
      ...draft,
      form: {
        ...form,
        exercises: [{ exerciseId: exercise, sets: [{ reps: '0', weightKg: '' }] }],
      },
    };

    expect(parseOwnedWorkoutDraft(JSON.stringify(emptyExercises), owner)).toBeNull();
    expect(parseOwnedWorkoutDraft(JSON.stringify(invalidReps), owner)).toBeNull();
    expect(() => createOfflineWorkoutDraft('not-a-uuid', form, 123)).toThrow();
    expect(() => createOfflineWorkoutDraft(owner, form, -1)).toThrow();
  });

  it('requires the correct account, connectivity and explicit review', () => {
    const draft = createOfflineWorkoutDraft(owner, form, 123);

    expect(canSendReviewedDraft(draft, owner, false, true)).toBe(false);
    expect(canSendReviewedDraft(draft, owner, true, false)).toBe(false);
    expect(canSendReviewedDraft(draft, other, true, true)).toBe(false);
    expect(canSendReviewedDraft(draft, null, true, true)).toBe(false);
    expect(canSendReviewedDraft(draft, owner, true, true)).toBe(true);
  });

  it('rejects a corrupted draft passed directly to the eligibility predicate', () => {
    const draft = createOfflineWorkoutDraft(owner, form, 123);
    const corrupted = { ...draft, state: 'READY' };

    expect(canSendReviewedDraft(corrupted, owner, true, true)).toBe(false);
  });
});
