import { defaultWorkoutPreferences, isRestDuration, type WorkoutPreferences } from '@gym/domain';
import type { paths } from '@gym/api-client';

type Resource = paths['/users/me/preferences/workouts'];
export type StoredWorkoutPreferences =
  Resource['get']['responses'][200]['content']['application/json'];
export type WorkoutPreferencePatch =
  Resource['patch']['requestBody']['content']['application/json'];

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export const legacyWorkoutPreferenceKey = (
  accountId: string,
  field: 'auto-rest-timer' | 'rest-duration',
) => `gym-platform:app-settings:v1:${accountId}:${field}`;

// Keep server-confirmed snapshots separate from the original explicit device values.
export const confirmedWorkoutPreferencesKey = (accountId: string) =>
  `gym-platform:app-settings:v2:${accountId}:confirmed-workout-preferences`;

export function parseStoredWorkoutPreferences(value: unknown): StoredWorkoutPreferences | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { autoRestTimer, restDurationSeconds } = value as Record<string, unknown>;
  if (
    Object.keys(value).length !== 2 ||
    (autoRestTimer !== null && typeof autoRestTimer !== 'boolean') ||
    (restDurationSeconds !== null && !isRestDuration(restDurationSeconds))
  ) {
    return null;
  }
  return { autoRestTimer, restDurationSeconds };
}

export async function readConfirmedWorkoutPreferences(storage: Storage, accountId: string) {
  const raw = await storage.getItem(confirmedWorkoutPreferencesKey(accountId));
  if (raw === null) return null;
  try {
    return parseStoredWorkoutPreferences(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveConfirmedWorkoutPreferences(
  storage: Storage,
  accountId: string,
  preferences: StoredWorkoutPreferences,
) {
  const validated = parseStoredWorkoutPreferences(preferences);
  if (!validated) throw new Error('Invalid confirmed workout preferences');
  await storage.setItem(confirmedWorkoutPreferencesKey(accountId), JSON.stringify(validated));
}

/** Missing, unreadable or malformed legacy values are never sent to initialize. */
export async function readLegacyWorkoutPreferences(storage: Storage, accountId: string) {
  const [auto, duration] = await Promise.allSettled([
    storage.getItem(legacyWorkoutPreferenceKey(accountId, 'auto-rest-timer')),
    storage.getItem(legacyWorkoutPreferenceKey(accountId, 'rest-duration')),
  ]);
  const rawAuto = auto.status === 'fulfilled' ? auto.value : undefined;
  const rawDuration = duration.status === 'fulfilled' ? duration.value : undefined;
  const seconds = Number(rawDuration);
  return {
    autoRestTimer: rawAuto === 'true' ? true : rawAuto === 'false' ? false : null,
    restDurationSeconds:
      isRestDuration(seconds) && String(seconds) === rawDuration ? seconds : null,
    // Preserve the existing safe-off behavior until a valid server value is known.
    safeAutoFallback:
      rawAuto === null ? defaultWorkoutPreferences.autoRestTimer : rawAuto === 'true',
  };
}

export type LegacyWorkoutPreferences = Awaited<ReturnType<typeof readLegacyWorkoutPreferences>>;

/** Only explicit valid values for fields the server reports as uninitialized. */
export function buildWorkoutPreferenceInitialization(
  remote: StoredWorkoutPreferences,
  legacy: LegacyWorkoutPreferences,
): WorkoutPreferencePatch | null {
  const autoRestTimer = remote.autoRestTimer === null ? legacy.autoRestTimer : null;
  const restDurationSeconds =
    remote.restDurationSeconds === null ? legacy.restDurationSeconds : null;
  if (autoRestTimer !== null) {
    return restDurationSeconds === null
      ? { autoRestTimer }
      : { autoRestTimer, restDurationSeconds };
  }
  return restDurationSeconds === null ? null : { restDurationSeconds };
}

/** Read-only effective values; a cached/remote explicit choice always wins. */
export function effectiveWorkoutPreferences(
  canonical: StoredWorkoutPreferences | null,
  legacy: LegacyWorkoutPreferences,
): WorkoutPreferences {
  return {
    autoRestTimer: canonical?.autoRestTimer ?? legacy.safeAutoFallback,
    restDurationSeconds:
      canonical?.restDurationSeconds ??
      legacy.restDurationSeconds ??
      defaultWorkoutPreferences.restDurationSeconds,
  };
}
