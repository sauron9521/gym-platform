import { describe, expect, it } from 'vitest';
import {
  availableProgramWeeks,
  filterProgramWorkouts,
} from '../../src/features/training-programs/lib/program-week-preview';

const days = [
  { id: 'w3d1', weekNumber: 3, dayNumber: 1 },
  { id: 'w1d1', weekNumber: 1, dayNumber: 1 },
  { id: 'w3d2', weekNumber: 3, dayNumber: 2 },
];

describe('trainer program week preview', () => {
  it('exposes sorted unique weeks without assuming contiguous schedule', () => {
    expect(availableProgramWeeks(days)).toEqual([1, 3]);
  });

  it('shows every workout in All view and only matching workouts in single-week view', () => {
    expect(filterProgramWorkouts(days, null)).toEqual(days);
    expect(filterProgramWorkouts(days, 3).map((day) => day.id)).toEqual(['w3d1', 'w3d2']);
    expect(filterProgramWorkouts(days, 2)).toEqual([]);
  });

  it('rejects invalid weeks instead of displaying unrelated days', () => {
    expect(filterProgramWorkouts(days, 0)).toEqual([]);
    expect(filterProgramWorkouts(days, NaN)).toEqual([]);
  });
});
