'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@gym/ui-web';

import { getDashboardWorkoutErrorKey } from '../lib/dashboard-workout-error';

import { nextPlannedWorkoutQueryOptions } from '@/features/workouts/api/next-planned-workout-query';
import { WorkoutListRequestError } from '@/features/workouts/api/workouts-list-query';
import { useAuthFailure } from '@/shared/api/use-auth-failure';

/** Mounted only when the athlete has no IN_PROGRESS workouts. */
export function DashboardNextPlannedWorkout() {
  const t = useTranslations('web.dashboard');
  const format = useFormatter();
  const onAuthFailure = useAuthFailure();
  const query = useQuery(nextPlannedWorkoutQueryOptions());

  useEffect(() => {
    if (query.error instanceof WorkoutListRequestError) {
      onAuthFailure(query.error);
    }
  }, [query.error, onAuthFailure]);

  const unauthenticated =
    query.error instanceof WorkoutListRequestError && query.error.status === 401;
  if (unauthenticated) return null;

  if (query.isPending || query.isFetching) {
    return (
      <>
        <h2 id="dashboard-next-step" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('workoutHero.checkingUpcoming')}
        </h2>
        <p role="status" className="text-sm text-muted-foreground">
          {t('workoutHero.loadingUpcoming')}
        </p>
      </>
    );
  }

  if (query.isError) {
    return (
      <>
        <h2 id="dashboard-next-step" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('workoutHero.errorUpcoming')}
        </h2>
        <div role="alert" className="space-y-3">
          <p className="text-sm text-destructive">{t(getDashboardWorkoutErrorKey(query.error))}</p>
          <Button size="touch" type="button" variant="outline" onClick={() => void query.refetch()}>
            {t('workoutHero.retry')}
          </Button>
        </div>
      </>
    );
  }

  const workout = query.data?.workout;
  // A previously cached time may have passed while the tab was open.
  const isFuture =
    workout?.scheduledAt &&
    query.data?.requestedFrom &&
    Date.parse(workout.scheduledAt) >= Date.parse(query.data.requestedFrom);

  if (!workout || !isFuture) {
    return (
      <>
        <h2 id="dashboard-next-step" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('heroTitle')}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t('workoutHero.noUpcoming')}
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            asChild
            size="touch"
            className="bg-[var(--brand-teal)] text-[var(--set-active-foreground)] hover:opacity-90"
          >
            <Link href="/workouts/new">{t('createWorkout')}</Link>
          </Button>
          <Button asChild size="touch" variant="outline">
            <Link href="/workouts">{t('openJournal')}</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <h2
        id="dashboard-next-step"
        className="break-words text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        {workout.title}
      </h2>
      <p className="text-sm font-semibold text-[var(--brand-teal)]">
        {t('workoutHero.upcomingStatus')}
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
        {t('workoutHero.scheduledAt', {
          date: workout.scheduledAt
            ? format.dateTime(new Date(workout.scheduledAt), {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : t('workoutHero.dateUnavailable'),
        })}
      </p>
      {'exerciseCount' in workout && typeof workout.exerciseCount === 'number' && (
        <p className="text-sm text-muted-foreground">
          {t('workoutHero.exerciseCount', { count: workout.exerciseCount })}
        </p>
      )}
      <div className="flex flex-wrap gap-3 pt-2">
        <Button
          asChild
          size="touch"
          className="bg-[var(--brand-teal)] text-[var(--set-active-foreground)] hover:opacity-90"
        >
          <Link href={`/workouts/${workout.id}`}>{t('workoutHero.viewAndStart')}</Link>
        </Button>
        <Button asChild size="touch" variant="outline">
          <Link href="/workouts">{t('openJournal')}</Link>
        </Button>
      </div>
    </>
  );
}
