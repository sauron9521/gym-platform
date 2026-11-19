'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@gym/ui-web';

import { DashboardNextPlannedWorkout } from './dashboard-next-planned-workout';
import { getDashboardWorkoutErrorKey } from '../lib/dashboard-workout-error';

import {
  WorkoutListRequestError,
  workoutListQueryOptions,
} from '@/features/workouts/api/workouts-list-query';
import { useAuthFailure } from '@/shared/api/use-auth-failure';

/**
 * Athlete-only contextual hero. The existing /workouts/[id] detail view
 * supports editing sets in an IN_PROGRESS workout; this link navigates
 * there without calling the start-workout mutation again.
 *
 * The API orders by createdAt DESC, so we deliberately select the newest
 * CREATED in-progress workout, not the most recently started session.
 */
export function DashboardActiveWorkout() {
  const t = useTranslations('web.dashboard');
  const format = useFormatter();
  const onAuthFailure = useAuthFailure();
  const query = useQuery(workoutListQueryOptions('IN_PROGRESS', 1));

  useEffect(() => {
    if (query.error instanceof WorkoutListRequestError) {
      onAuthFailure(query.error);
    }
  }, [query.error, onAuthFailure]);

  const unauthenticated =
    query.error instanceof WorkoutListRequestError && query.error.status === 401;
  const loading = query.isPending || query.isFetching;
  const workout = query.data?.workouts[0];

  // Never display stale private workout details after HTTP 401.
  if (unauthenticated) return null;

  return (
    <section
      aria-labelledby="dashboard-next-step"
      className="relative overflow-hidden rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8 lg:p-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-secondary/60 blur-3xl"
      />
      <div className="relative max-w-2xl space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t('nextStep')}
        </p>

        {loading && (
          <>
            <h2
              id="dashboard-next-step"
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              {t('workoutHero.checkingActive')}
            </h2>
            <p role="status" className="text-sm text-muted-foreground">
              {t('workoutHero.loadingActive')}
            </p>
          </>
        )}

        {!loading && query.isError && (
          <>
            <h2
              id="dashboard-next-step"
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              {t('workoutHero.errorActive')}
            </h2>
            <div role="alert" className="space-y-3">
              <p className="text-sm text-destructive">
                {t(getDashboardWorkoutErrorKey(query.error))}
              </p>
              <Button
                type="button"
                size="touch"
                variant="outline"
                onClick={() => void query.refetch()}
              >
                {t('workoutHero.retry')}
              </Button>
            </div>
          </>
        )}

        {!loading && !query.isError && !workout && <DashboardNextPlannedWorkout />}

        {!loading && !query.isError && workout && (
          <>
            <h2
              id="dashboard-next-step"
              className="break-words text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              {workout.title}
            </h2>
            <p className="text-sm font-semibold text-[var(--brand-teal)]">
              {t('workoutHero.activeStatus')}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t('workoutHero.activeIntro')}
              {workout.startedAt &&
                ` ${t('workoutHero.startedAt', {
                  date: format.dateTime(new Date(workout.startedAt), {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}`}
            </p>
            {typeof query.data?.total === 'number' && query.data.total > 1 && (
              <p className="text-sm text-muted-foreground">
                {t('workoutHero.activeCount', { count: query.data.total })}
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                asChild
                size="touch"
                className="bg-[var(--brand-teal)] text-[var(--set-active-foreground)] hover:opacity-90"
              >
                <Link href={`/workouts/${workout.id}`}>{t('workoutHero.continueWorkout')}</Link>
              </Button>
              <Button asChild size="touch" variant="outline">
                <Link href="/workouts">{t('openJournal')}</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
