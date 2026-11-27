'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient, onlineManager } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { defaultWorkoutPreferences, restDurationPresets } from '@gym/domain';

import { useAuthFailure } from '@/shared/api/use-auth-failure';
import { Button } from '@/shared/ui/button';
import {
  updateWorkoutPreferences,
  WorkoutPreferencesError,
  workoutPreferencesOptions,
  type WorkoutPreferencesPatch,
} from '../api/workout-preferences';

const subscribeOnline = (listener: () => void) => onlineManager.subscribe(listener);
const getOnline = () => onlineManager.isOnline();
const serverOnline = () => true;

type Write = { body: WorkoutPreferencesPatch; isCurrent: () => boolean };

export function WorkoutPreferencesSettings({
  accountId,
  children,
}: {
  accountId: string;
  children?: ReactNode;
}) {
  const t = useTranslations('web.appSettings');
  const client = useQueryClient();
  const onAuthFailure = useAuthFailure();
  const online = useSyncExternalStore(subscribeOnline, getOnline, serverOnline);
  const timerHintId = useId();
  const inFlight = useRef(false);
  const options = workoutPreferencesOptions(accountId);
  const filter = { queryKey: options.queryKey, exact: true } as const;

  const mutation = useMutation({
    mutationFn: async ({ body, isCurrent }: Write) => {
      // NetworkMode always prevents TanStack from queuing an offline mutation.
      if (!getOnline()) throw new WorkoutPreferencesError();
      await client.cancelQueries(filter);
      return updateWorkoutPreferences(accountId, body, isCurrent);
    },
    onSuccess: async (data, { isCurrent }) => {
      if (!isCurrent()) return;
      await client.cancelQueries(filter);
      if (isCurrent()) client.setQueryData(options.queryKey, data);
    },
    onError: async (error, { isCurrent }) => {
      if (!isCurrent()) return;
      if (error instanceof WorkoutPreferencesError) {
        if (error.scopeChanged) return;
        if (error.status === 401) {
          onAuthFailure(error);
          return;
        }
      }
      // An interrupted PATCH may have committed. Reconcile only via GET.
      await client.invalidateQueries({ ...filter, refetchType: 'none' });
      if (getOnline() && isCurrent()) {
        await client
          .fetchQuery({ ...options, staleTime: 0, networkMode: 'always' })
          .catch(() => undefined);
      }
    },
    retry: false,
    networkMode: 'always',
  });
  const query = useQuery({ ...options, enabled: !mutation.isPending });

  useEffect(() => {
    if (query.error instanceof WorkoutPreferencesError) onAuthFailure(query.error);
  }, [query.error, onAuthFailure]);

  async function change(body: WorkoutPreferencesPatch) {
    if (inFlight.current || !getOnline() || !query.data || query.isError || query.isFetching)
      return;
    const entry = client.getQueryCache().find(filter);
    if (!entry) return;
    const isCurrent = () => client.getQueryCache().find(filter) === entry;
    inFlight.current = true;
    try {
      await mutation.mutateAsync({ body, isCurrent });
    } catch {
      // Localized feedback below; never retry a PATCH automatically.
    } finally {
      inFlight.current = false;
    }
  }

  const sessionFailure = [query.error, mutation.error].find(
    (error) =>
      error instanceof WorkoutPreferencesError && (error.scopeChanged || error.status === 401),
  );
  const failure = sessionFailure ?? mutation.error ?? query.error;
  const scopeChanged = failure instanceof WorkoutPreferencesError && failure.scopeChanged;
  const signedOut = failure instanceof WorkoutPreferencesError && failure.status === 401;
  const data = scopeChanged || signedOut ? undefined : query.data;
  const disabled = !online || !data || query.isError || query.isFetching || mutation.isPending;
  const auto = data?.autoRestTimer ?? defaultWorkoutPreferences.autoRestTimer;
  const duration = data?.restDurationSeconds ?? defaultWorkoutPreferences.restDurationSeconds;

  async function reload() {
    mutation.reset();
    await query.refetch();
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/profile"
        className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        ← {t('back')}
      </Link>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </header>
      <section
        aria-labelledby="workout-settings-heading"
        className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6"
      >
        <div className="space-y-1">
          <h2 id="workout-settings-heading" className="text-xl font-semibold">
            {t('workouts')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('accountHint')}</p>
        </div>
        {data && (
          <fieldset disabled={disabled} className="space-y-5 disabled:opacity-70">
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
              <span className="space-y-1">
                <span className="block font-medium">{t('autoRestTimer')}</span>
                <span id={timerHintId} className="block text-sm text-muted-foreground">
                  {t('autoHint')}
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-label={t('autoRestTimer')}
                aria-describedby={timerHintId}
                checked={auto}
                onChange={(event) => void change({ autoRestTimer: event.target.checked })}
                className="size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
              />
            </label>
            <fieldset className="space-y-2 border-t pt-4">
              <legend className="font-medium">{t('restDuration')}</legend>
              <div className="flex flex-wrap gap-2">
                {restDurationPresets.map((seconds) => (
                  <label
                    key={seconds}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm has-checked:border-primary has-checked:bg-primary/10"
                  >
                    <input
                      type="radio"
                      name="rest-duration"
                      value={seconds}
                      checked={duration === seconds}
                      onChange={() => void change({ restDurationSeconds: seconds })}
                      className="accent-primary focus-visible:outline-2 focus-visible:outline-ring"
                    />
                    {t('seconds', { seconds })}
                  </label>
                ))}
              </div>
            </fieldset>
          </fieldset>
        )}
        {!online && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('offline')}
          </p>
        )}
        {online && (query.isPending || query.isFetching || mutation.isPending) && (
          <p role="status" className="text-sm text-muted-foreground">
            {t(mutation.isPending ? 'saving' : 'loading')}
          </p>
        )}
        {failure && !signedOut && (
          <div role="alert" className="space-y-2 text-sm text-destructive">
            <p>{t(scopeChanged ? 'scopeChanged' : mutation.isError ? 'saveError' : 'loadError')}</p>
            {!scopeChanged && (
              <Button
                type="button"
                variant="outline"
                disabled={!online || mutation.isPending || query.isFetching}
                onClick={() => void reload()}
              >
                {t('retry')}
              </Button>
            )}
          </div>
        )}
        {signedOut && <p role="alert">{t('signedOut')}</p>}
        {mutation.isSuccess && data && !query.isError && (
          <p role="status" className="text-sm text-primary">
            {t('saved')}
          </p>
        )}
      </section>
      {children}
    </main>
  );
}
