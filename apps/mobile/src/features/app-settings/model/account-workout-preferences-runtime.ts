import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager, QueryObserver, type QueryClient } from '@tanstack/react-query';
import { defaultWorkoutPreferences, type WorkoutPreferences } from '@gym/domain';

import { accountQueryKeys } from '@/shared/api/query-client';
import { MobileSessionExpiredError } from '@/shared/api/api-error-policy';
import {
  buildWorkoutPreferenceInitialization,
  effectiveWorkoutPreferences,
  readConfirmedWorkoutPreferences,
  readLegacyWorkoutPreferences,
  saveConfirmedWorkoutPreferences,
  type LegacyWorkoutPreferences,
  type StoredWorkoutPreferences,
  type WorkoutPreferencePatch,
} from './account-workout-preferences';
import {
  workoutPreferencesQueryOptions,
  writeWorkoutPreferences,
} from './account-workout-preferences-query';
import type { createMobileApi } from '@/shared/api/client';

export type AccountPreferenceStatus = 'loading' | 'ready' | 'saving' | 'offline' | 'error';
export type AccountPreferenceConnection = {
  queryClient: QueryClient;
  getScopedApi: (isCurrent: () => boolean) => ReturnType<typeof createMobileApi> | null;
  signOut: () => Promise<void>;
};

type Publish = (
  preferences: WorkoutPreferences | undefined,
  status: AccountPreferenceStatus,
) => void;

/** TanStack Query owns the canonical online snapshot. The store receives only
 * effective values for synchronous timer consumers. Never persist legacy keys
 * after activation or send a queued write on reconnect. */
export function activateAccountWorkoutPreferences(
  accountId: string,
  connection: AccountPreferenceConnection,
  pending: Map<string, Promise<void>>,
  publish: Publish,
) {
  const { queryClient } = connection;
  const key = accountQueryKeys.workoutPreferences(accountId);
  const markerKey = accountQueryKeys.me(accountId);
  const marker = queryClient.getQueryCache().find({ queryKey: markerKey, exact: true });
  let active = true;
  let legacy: LegacyWorkoutPreferences | undefined;
  let hydrated = false;
  let busy = false;
  let attemptedImport = false;
  let needsRead = true;
  let error = false;
  let snapshotError = false;
  let uncertain: { kind: 'initialize' | 'update'; body: WorkoutPreferencePatch } | undefined;
  let lastData: StoredWorkoutPreferences | undefined;
  let lastUpdated = -1;
  const current = () =>
    active &&
    Boolean(marker && queryClient.getQueryData(markerKey)) &&
    queryClient.getQueryCache().find({ queryKey: markerKey, exact: true }) === marker;
  const scope = { accountId, isCurrent: current, getScopedApi: connection.getScopedApi };
  const options = workoutPreferencesQueryOptions(scope);
  const observer = new QueryObserver(queryClient, { ...options, enabled: false });
  // Keep the verified-session marker alive while this scope is active; an
  // otherwise inactive /me cache entry would be garbage collected after 5m.
  const markerObserver = marker
    ? new QueryObserver(queryClient, { queryKey: markerKey, enabled: false })
    : null;
  const unpinMarker = markerObserver?.subscribe(() => undefined);

  const filter = { queryKey: key, exact: true } as const;
  const status = (): AccountPreferenceStatus =>
    !hydrated
      ? 'loading'
      : busy
        ? 'saving'
        : !onlineManager.isOnline()
          ? 'offline'
          : error || snapshotError || uncertain
            ? 'error'
            : needsRead
              ? 'loading'
              : 'ready';

  function emit(preferences?: WorkoutPreferences) {
    if (current()) publish(preferences, status());
  }

  function queue(work: () => Promise<void>) {
    const previous = pending.get(accountId);
    const task = Promise.resolve(previous)
      .catch(() => undefined)
      .then(work);
    pending.set(accountId, task);
    void task
      .finally(() => {
        if (pending.get(accountId) === task) pending.delete(accountId);
      })
      .catch(() => undefined);
    return task;
  }

  function persist(data: StoredWorkoutPreferences) {
    void queue(async () => {
      if (!current()) return;
      try {
        await saveConfirmedWorkoutPreferences(AsyncStorage, accountId, data);
        if (!current()) return;
        snapshotError = false;
      } catch {
        if (!current()) return;
        snapshotError = true;
      }
      emit();
    });
  }

  function apply(data: StoredWorkoutPreferences, updatedAt: number) {
    if (!current() || !legacy) return;
    lastData = data;
    lastUpdated = updatedAt;
    needsRead = false;
    if (uncertain) {
      const { kind, body } = uncertain;
      const matches = <T>(requested: T | undefined, actual: T | null) =>
        requested === undefined || (kind === 'initialize' ? actual !== null : actual === requested);
      if (
        matches(body.autoRestTimer, data.autoRestTimer) &&
        matches(body.restDurationSeconds, data.restDurationSeconds)
      )
        uncertain = undefined;
    }
    emit(effectiveWorkoutPreferences(data, legacy));
    persist(data);
  }

  async function handleExpired(cause: unknown) {
    if (cause instanceof MobileSessionExpiredError && current()) {
      await connection.signOut().catch(() => undefined);
    }
  }

  function configure() {
    observer.setOptions({ ...options, enabled: current() && hydrated && !busy });
  }

  // The observer may notify for loading/focus/online changes without new data.
  function consume(result: ReturnType<typeof observer.getCurrentResult>) {
    if (!current() || !hydrated || busy) return;
    if (result.isError) {
      error = true;
      needsRead = true;
      emit();
      void handleExpired(result.error).catch(() => undefined);
      return;
    }
    if (result.isSuccess && result.fetchStatus === 'idle' && result.data) {
      const fresh = result.data !== lastData || result.dataUpdatedAt !== lastUpdated || needsRead;
      if (fresh) {
        error = false;
        apply(result.data, result.dataUpdatedAt);
        const body = legacy && buildWorkoutPreferenceInitialization(result.data, legacy);
        if (body && !attemptedImport && onlineManager.isOnline()) {
          attemptedImport = true;
          void mutate('initialize', body);
        }
      }
    }
  }

  async function mutate(kind: 'initialize' | 'update', body: WorkoutPreferencePatch) {
    if (
      !current() ||
      !hydrated ||
      busy ||
      !onlineManager.isOnline() ||
      (kind === 'update' && (needsRead || error || snapshotError || uncertain))
    )
      return;
    busy = true;
    error = false;
    emit();
    configure();
    let failed = false;
    try {
      await queryClient.cancelQueries(filter);
      if (!current()) return;
      const data = await writeWorkoutPreferences(scope, kind, body);
      if (!current()) return;
      queryClient.setQueryData(key, data);
      apply(data, queryClient.getQueryState(key)?.dataUpdatedAt ?? 0);
    } catch (cause) {
      if (!current()) return;
      failed = true;
      uncertain = { kind, body };
      error = true;
      needsRead = true;
      await handleExpired(cause);
      if (!current()) return;
      // Never replay an uncertain write. A canonical GET may resolve it.
      await queryClient.invalidateQueries({ ...filter, refetchType: 'none' });
    } finally {
      busy = false;
      if (current()) {
        emit();
        configure();
        if (failed && onlineManager.isOnline()) {
          // configure may already have started the same GET; join it.
          void observer.refetch({ cancelRefetch: false }).catch(() => undefined);
        }
      }
    }
  }

  const unsubscribeObserver = observer.subscribe(consume);
  const unsubscribeOnline = onlineManager.subscribe(() => {
    if (!current()) return;
    needsRead = true;
    emit();
  });
  const unsubscribeCache = queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'removed' && event.query === marker) {
      // Synchronously fence responses on auth cache clear, including same-ID login.
      active = false;
      publish(
        {
          autoRestTimer: false,
          restDurationSeconds: defaultWorkoutPreferences.restDurationSeconds,
        },
        'loading',
      );
      unsubscribeObserver();
      unsubscribeOnline();
      unpinMarker?.();
    }
  });

  void (async () => {
    await Promise.resolve(pending.get(accountId)).catch(() => undefined);
    if (!current()) return;
    const [local, snapshot] = await Promise.all([
      readLegacyWorkoutPreferences(AsyncStorage, accountId),
      readConfirmedWorkoutPreferences(AsyncStorage, accountId).then(
        (cached) => ({ cached, readFailed: false }),
        () => ({ cached: null, readFailed: true }),
      ),
    ]);
    if (!current()) return;
    legacy = local;
    hydrated = true;
    const fallback = effectiveWorkoutPreferences(snapshot.cached, legacy);
    emit(snapshot.readFailed ? { ...fallback, autoRestTimer: false } : fallback);
    configure();
    consume(observer.getCurrentResult());
  })().catch(() => {
    if (!current()) return;
    hydrated = true;
    error = true;
    emit();
  });

  return {
    update: (body: WorkoutPreferencePatch) => mutate('update', body),
    retry() {
      if (!current() || !hydrated || busy || !onlineManager.isOnline()) return;
      attemptedImport = false;
      uncertain = undefined;
      error = false;
      needsRead = true;
      emit();
      void observer.refetch({ cancelRefetch: false }).catch(() => undefined);
    },
    close() {
      active = false;
      unsubscribeCache();
      unpinMarker?.();
      unsubscribeObserver();
      unsubscribeOnline();
      // Detach the old observer; do not cancel a newer account's query.
    },
  };
}
