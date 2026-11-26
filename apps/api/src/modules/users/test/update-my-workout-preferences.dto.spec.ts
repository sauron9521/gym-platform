import { restDurationPresets } from '@gym/domain';
import { updateMyWorkoutPreferencesSchema } from '../dto/update-my-workout-preferences.dto.js';

describe('updateMyWorkoutPreferencesSchema', () => {
  it('accepts independent values and preserves explicit false', () => {
    expect(updateMyWorkoutPreferencesSchema.parse({ autoRestTimer: false })).toEqual({
      autoRestTimer: false,
    });
    for (const restDurationSeconds of restDurationPresets) {
      expect(updateMyWorkoutPreferencesSchema.parse({ restDurationSeconds })).toEqual({
        restDurationSeconds,
      });
    }
    expect(
      updateMyWorkoutPreferencesSchema.safeParse({ autoRestTimer: true, restDurationSeconds: 90 })
        .success,
    ).toBe(true);
  });

  it.each([
    {},
    { autoRestTimer: undefined },
    { autoRestTimer: null },
    { autoRestTimer: 'false' },
    { restDurationSeconds: null },
    { restDurationSeconds: '90' },
    { restDurationSeconds: 91 },
    { autoRestTimer: false, userId: 'other' },
    { restDurationSeconds: 90, restSound: true },
    { autoRestTimer: true, preferredLocale: 'en' },
  ])('rejects invalid or unrelated fields: %j', (value) => {
    expect(updateMyWorkoutPreferencesSchema.safeParse(value).success).toBe(false);
  });
});
