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
  it('creates a valid versioned draft and loads it only for its owner', () => {
    const draft = createOfflineWorkoutDraft(owner, form, 123);
    const json = JSON.stringify(draft);
    expect(draft.schemaVersion).toBe(1);
    expect(draft.state).toBe('REQUIRES_REVIEW');
    expect(parseOwnedWorkoutDraft(json, owner)).toEqual(draft);
    expect(parseOwnedWorkoutDraft(json, other)).toBeNull();
    expect(parseOwnedWorkoutDraft(json, '')).toBeNull();
  });

  it('rejects corrupt, unsupported-version, malformed or oversized stored data', () => {
    const draft = createOfflineWorkoutDraft(owner, form, 123);
    expect(parseOwnedWorkoutDraft('{corrupt', owner)).toBeNull();
    expect(parseOwnedWorkoutDraft(JSON.stringify({ ...draft, schemaVersion: 2 }), owner)).toBeNull();
    expect(parseOwnedWorkoutDraft(JSON.stringify({ ...draft, savedAt: -1 }), owner)).toBeNull();
    expect(parseOwnedWorkoutDraft(JSON.stringify({ ...draft, state: 'READY' }), owner)).toBeNull();
    expect(parseOwnedWorkoutDraft(JSON.stringify({ ...draft, token: 'secret' }), owner)).toBeNull();
    expect(parseOwnedWorkoutDraft(' '.repeat(1_000_001), owner)).toBeNull();
  });

  it('validates nested exercise and set limits before storing or restoring', () => {
    const draft = createOfflineWorkoutDraft(owner, form, 123);
    expect(
      parseOwnedWorkoutDraft(
        JSON.stringify({ ...draft, form: { ...form, exercises: [] } }),
        owner,
      ),
    ).toBeNull();
    expect(
      parseOwnedWorkoutDraft(
        JSON.stringify({
          ...draft,
          form: {
            ...form,
            exercises: [{ exerciseId: exercise, sets: [{ reps: '0', weightKg: '' }] }],
          },
        }),
        owner,
      ),
    ).toBeNull();
    expect(() => createOfflineWorkoutDraft('not-a-uuid', form, 123)).toThrow();
    expect(() => createOfflineWorkoutDraft(owner, form, -1)).toThrow();
  });

  it('never permits unreviewed, offline, signed-out or cross-account replay', () => {
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
