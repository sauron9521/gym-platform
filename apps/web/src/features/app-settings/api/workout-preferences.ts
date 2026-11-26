import { isRestDuration } from '@gym/domain';
import type { paths } from '@gym/api-client';
import { onlineManager, queryOptions } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';

const path = '/users/me/preferences/workouts' as const;
type Resource = paths[typeof path];
export type StoredWorkoutPreferences =
  Resource['get']['responses'][200]['content']['application/json'];
export type WorkoutPreferencesPatch =
  Resource['patch']['requestBody']['content']['application/json'];

export class WorkoutPreferencesError extends Error {
  constructor(
    readonly status?: number,
    readonly scopeChanged = false,
  ) {
    super(scopeChanged ? 'Account changed' : 'Workout preferences request failed');
    this.name = 'WorkoutPreferencesError';
  }
}

function parse(data: unknown): StoredWorkoutPreferences {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new WorkoutPreferencesError();
  }
  const { autoRestTimer, restDurationSeconds } = data as Record<string, unknown>;
  if (
    Object.keys(data).length !== 2 ||
    (autoRestTimer !== null && typeof autoRestTimer !== 'boolean') ||
    (restDurationSeconds !== null && !isRestDuration(restDurationSeconds))
  ) {
    throw new WorkoutPreferencesError();
  }
  return { autoRestTimer, restDurationSeconds };
}

export const workoutPreferencesKey = (accountId: string) =>
  ['profile', 'workout-preferences', accountId] as const;

/** The protected route supplies the verified owner; recheck the browser
 * session before using a resource (e.g. another tab may have signed in). */
async function verifyOwner(accountId: string, signal?: AbortSignal) {
  const { response, data } = await webApi.GET('/users/me', { signal });
  if (response.status !== 200 || !data) throw new WorkoutPreferencesError(response.status);
  if (data.id !== accountId) throw new WorkoutPreferencesError(undefined, true);
}

export function workoutPreferencesOptions(accountId: string) {
  return queryOptions({
    queryKey: workoutPreferencesKey(accountId),
    queryFn: async ({ signal }) => {
      await verifyOwner(accountId, signal);
      const { response, data } = await webApi.GET(path, { signal });
      if (response.status !== 200) throw new WorkoutPreferencesError(response.status);
      await verifyOwner(accountId, signal);
      return parse(data);
    },
    retry: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
}

/** No retry, initialization, optimistic updates, or offline replay. */
export async function updateWorkoutPreferences(
  accountId: string,
  body: WorkoutPreferencesPatch,
  isCurrent: () => boolean,
) {
  const assertCurrent = () => {
    if (!isCurrent()) throw new WorkoutPreferencesError(undefined, true);
  };
  assertCurrent();
  await verifyOwner(accountId);
  assertCurrent();
  if (!onlineManager.isOnline()) throw new WorkoutPreferencesError();
  const { response, data } = await webApi.PATCH(path, { body });
  assertCurrent();
  if (response.status !== 200) throw new WorkoutPreferencesError(response.status);
  await verifyOwner(accountId);
  assertCurrent();
  return parse(data);
}
