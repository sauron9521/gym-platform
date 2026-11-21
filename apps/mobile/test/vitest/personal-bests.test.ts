import { describe, expect, it } from 'vitest';
import { exercisePersonalBests } from '../../src/features/progress/lib/personal-bests';

describe('exercisePersonalBests', () => {
  it('returns empty-safe values for no completed history', () => {
    expect(exercisePersonalBests([])).toEqual({
      bestWeightKg: null,
      activeDays: 0,
      bestVolumeDay: null,
    });
  });

  it('computes maximum weight, unique daily activity and top valid volume', () => {
    expect(
      exercisePersonalBests([
        { date: '2026-11-14', workoutCount: 1, bestWeightKg: 55, strengthVolumeKg: 440 },
        { date: '2026-11-15', workoutCount: 2, bestWeightKg: 60, strengthVolumeKg: 750 },
        { date: '2026-11-16', workoutCount: 0, bestWeightKg: null, strengthVolumeKg: 0 },
      ]),
    ).toEqual({
      bestWeightKg: 60,
      activeDays: 2,
      bestVolumeDay: { date: '2026-11-15', volumeKg: 750 },
    });
  });

  it('ignores invalid weights and workout counts without fabricating active days', () => {
    expect(
      exercisePersonalBests([
        { date: '2026-11-14', workoutCount: NaN, bestWeightKg: Infinity, strengthVolumeKg: -3 },
        { date: '2026-11-15', workoutCount: -1, bestWeightKg: -10, strengthVolumeKg: Infinity },
        { date: '2026-11-16', workoutCount: 1, bestWeightKg: 0, strengthVolumeKg: 50 },
      ]),
    ).toEqual({
      bestWeightKg: 0,
      activeDays: 1,
      bestVolumeDay: { date: '2026-11-16', volumeKg: 50 },
    });
  });

  it('ignores invalid volume and empty strength history without claiming a record', () => {
    expect(
      exercisePersonalBests([
        { date: '2026-11-14', workoutCount: 1, bestWeightKg: null, strengthVolumeKg: NaN },
        { date: '2026-11-15', workoutCount: 1, bestWeightKg: null, strengthVolumeKg: -50 },
      ]),
    ).toEqual({ bestWeightKg: null, activeDays: 2, bestVolumeDay: null });
  });
});
