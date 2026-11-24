import { describe, expect, it } from 'vitest';

import {
  normalizeWorkoutSetResult,
  SkippedSetPerformanceError,
} from '../application/workout-set-result.js';

describe('normalizeWorkoutSetResult', () => {
  const completedAt = new Date('2030-01-01T10:00:00Z');

  it('leaves omitted completed-set fields untouched', () => {
    expect(normalizeWorkoutSetResult({ status: 'COMPLETED' }, completedAt)).toEqual({
      status: 'COMPLETED',
      completedAt,
    });
  });

  it('preserves zero, fractional values, explicit clears and notes', () => {
    const input = {
      status: 'COMPLETED' as const,
      actualReps: 0,
      actualWeightKg: 62.75,
      actualDurationSeconds: null,
      actualDistanceMeters: 500.5,
      restSeconds: 0,
      rpe: 7.5,
      rir: 0,
      notes: null,
    };
    expect(normalizeWorkoutSetResult(input, completedAt)).toEqual({ ...input, completedAt });
  });

  it('clears all performance fields for skipped sets and preserves rest and notes', () => {
    expect(
      normalizeWorkoutSetResult({ status: 'SKIPPED', restSeconds: 0, notes: null }, completedAt),
    ).toEqual({
      status: 'SKIPPED',
      completedAt,
      actualReps: null,
      actualWeightKg: null,
      actualDurationSeconds: null,
      actualDistanceMeters: null,
      rpe: null,
      rir: null,
      restSeconds: 0,
      notes: null,
    });
  });

  it.each([
    'actualReps',
    'actualWeightKg',
    'actualDurationSeconds',
    'actualDistanceMeters',
    'rpe',
    'rir',
  ] as const)('rejects a non-null %s even when it is zero', (field) => {
    expect(() =>
      normalizeWorkoutSetResult({ status: 'SKIPPED', [field]: 0 }, completedAt),
    ).toThrow(SkippedSetPerformanceError);
  });

  it('accepts explicit null for skipped performance fields', () => {
    const result = normalizeWorkoutSetResult(
      { status: 'SKIPPED', actualWeightKg: null, rpe: null, rir: null },
      completedAt,
    );
    expect(result).toMatchObject({ actualWeightKg: null, rpe: null, rir: null });
    expect(result).not.toHaveProperty('restSeconds');
    expect(result).not.toHaveProperty('notes');
  });
});
