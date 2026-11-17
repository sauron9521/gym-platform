import { describe, expect, it } from 'vitest';
import { mobileMultiWorkoutFormSchema, buildMobileMultiWorkoutBody } from '../src/features/workouts/lib/create-workout-schema.ts';

const exercise1 = '11111111-1111-4111-8111-111111111111';
const exercise2 = '22222222-2222-4222-8222-222222222222';
const form = {
  title: '  Спина ',
  exercises: [
    { exerciseId: exercise1, sets: [{ reps: '8', weightKg: '62,5' }, { reps: '10', weightKg: '' }] },
    { exerciseId: exercise2, sets: [{ reps: '12', weightKg: '50' }] },
  ],
};

describe('mobile multi-exercise workout builder', () => {
  it('validates and converts the complete workout into the typed API shape', () => {
    expect(mobileMultiWorkoutFormSchema.safeParse(form).success).toBe(true);
    expect(buildMobileMultiWorkoutBody(form)).toEqual({
      title: 'Спина',
      exercises: [
        { exerciseId: exercise1, sets: [
          { setType: 'WORKING', plannedReps: 8, plannedWeightKg: 62.5 },
          { setType: 'WORKING', plannedReps: 10 },
        ] },
        { exerciseId: exercise2, sets: [{ setType: 'WORKING', plannedReps: 12, plannedWeightKg: 50 }] },
      ],
    });
  });
  it('rejects empty exercises, zero sets, fractional reps and over-limit weights', () => {
    expect(mobileMultiWorkoutFormSchema.safeParse({ ...form, exercises: [] }).success).toBe(false);
    expect(mobileMultiWorkoutFormSchema.safeParse({ ...form, exercises: [{ exerciseId: exercise1, sets: [] }] }).success).toBe(false);
    expect(mobileMultiWorkoutFormSchema.safeParse({ ...form, exercises: [{ exerciseId: exercise1, sets: [{ reps: '1.5', weightKg: '' }] }] }).success).toBe(false);
    expect(mobileMultiWorkoutFormSchema.safeParse({ ...form, exercises: [{ exerciseId: exercise1, sets: [{ reps: '10', weightKg: '1000000' }] }] }).success).toBe(false);
  });
});
