import { describe, expect, it } from 'vitest';

import {
  buildMobileMultiWorkoutBody,
  mobileMultiWorkoutFormSchema,
  resolveMultiWorkoutCreationAttempt,
} from '../src/features/workouts/lib/create-workout-schema.ts';

const exercise1 = '11111111-1111-4111-8111-111111111111';
const exercise2 = '22222222-2222-4222-8222-222222222222';
const form = {
  title: '  Спина ',
  exercises: [
    {
      exerciseId: exercise1,
      sets: [
        { reps: '8', weightKg: '62,5' },
        { reps: '10', weightKg: '' },
      ],
    },
    { exerciseId: exercise2, sets: [{ reps: '12', weightKg: '50' }] },
  ],
};

describe('mobile multi-exercise workout builder', () => {
  it('validates and converts sets with decimal weights into the typed API payload', () => {
    const parsed = mobileMultiWorkoutFormSchema.parse(form);
    expect(buildMobileMultiWorkoutBody(parsed)).toEqual({
      title: 'Спина',
      exercises: [
        {
          exerciseId: exercise1,
          sets: [
            { setType: 'WORKING', plannedReps: 8, plannedWeightKg: 62.5 },
            { setType: 'WORKING', plannedReps: 10 },
          ],
        },
        {
          exerciseId: exercise2,
          sets: [{ setType: 'WORKING', plannedReps: 12, plannedWeightKg: 50 }],
        },
      ],
    });
  });

  it('supports one exercise and one set through the active multi-workout path', () => {
    const parsed = mobileMultiWorkoutFormSchema.parse({
      title: '  Single exercise ',
      exercises: [{ exerciseId: exercise1, sets: [{ reps: '12', weightKg: '' }] }],
    });
    expect(buildMobileMultiWorkoutBody(parsed)).toEqual({
      title: 'Single exercise',
      exercises: [
        {
          exerciseId: exercise1,
          sets: [{ setType: 'WORKING', plannedReps: 12 }],
        },
      ],
    });
  });

  it('rejects missing exercises, empty sets, invalid reps and weights', () => {
    const invalid = [
      { ...form, exercises: [] },
      { ...form, exercises: [{ exerciseId: exercise1, sets: [] }] },
      { ...form, exercises: [{ exerciseId: 'not-a-uuid', sets: form.exercises[0].sets }] },
      { ...form, exercises: [{ exerciseId: exercise1, sets: [{ reps: '1.5', weightKg: '' }] }] },
      { ...form, exercises: [{ exerciseId: exercise1, sets: [{ reps: '0', weightKg: '' }] }] },
      { ...form, exercises: [{ exerciseId: exercise1, sets: [{ reps: '1001', weightKg: '' }] }] },
      { ...form, exercises: [{ exerciseId: exercise1, sets: [{ reps: '10', weightKg: '-2' }] }] },
      {
        ...form,
        exercises: [{ exerciseId: exercise1, sets: [{ reps: '10', weightKg: '10.123' }] }],
      },
      {
        ...form,
        exercises: [{ exerciseId: exercise1, sets: [{ reps: '10', weightKg: '1000000' }] }],
      },
    ];
    for (const entry of invalid) {
      expect(mobileMultiWorkoutFormSchema.safeParse(entry).success).toBe(false);
    }
  });

  it('accepts exact API boundaries: 50 exercises, 100 sets, and zero weight', () => {
    const sets = Array.from({ length: 100 }, () => ({ reps: '1000', weightKg: '0' }));
    const exercises = Array.from({ length: 50 }, () => ({
      exerciseId: exercise1,
      sets,
    }));
    expect(mobileMultiWorkoutFormSchema.safeParse({ title: 'Valid', exercises }).success).toBe(
      true,
    );
    expect(
      mobileMultiWorkoutFormSchema.safeParse({
        title: 'Valid',
        exercises: [...exercises, exercises[0]],
      }).success,
    ).toBe(false);
    expect(
      mobileMultiWorkoutFormSchema.safeParse({
        title: 'Valid',
        exercises: [{ exerciseId: exercise1, sets: [...sets, sets[0]] }],
      }).success,
    ).toBe(false);
  });

  it('reuses idempotency key for the same canonical payload and replaces it after edits', () => {
    let keys = 0;
    const key = () => `mobile-key-${++keys}`;
    const parsed = mobileMultiWorkoutFormSchema.parse(form);
    const initial = resolveMultiWorkoutCreationAttempt(parsed, null, key);
    const replay = resolveMultiWorkoutCreationAttempt({ ...parsed, title: 'Спина' }, initial, key);
    const changed = resolveMultiWorkoutCreationAttempt(
      {
        ...parsed,
        exercises: [{ ...parsed.exercises[0], sets: [{ reps: '7', weightKg: '' }] }],
      },
      replay,
      key,
    );
    expect(replay.key).toBe(initial.key);
    expect(changed.key).not.toBe(initial.key);
    expect(keys).toBe(2);
  });
});
