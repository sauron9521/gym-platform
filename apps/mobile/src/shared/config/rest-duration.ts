import { defaultWorkoutPreferences, restDurationPresets, type RestDuration } from '@gym/domain';

export { restDurationPresets, type RestDuration };
export const defaultRestDuration = defaultWorkoutPreferences.restDurationSeconds;

/** Legacy AsyncStorage codec: only exact canonical strings are valid. */
export function parseRestDuration(value: string | null): RestDuration {
  return restDurationPresets.find((seconds) => String(seconds) === value) ?? defaultRestDuration;
}
