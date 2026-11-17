'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { workoutListQueryOptions, WorkoutListRequestError } from '../api/workouts-list-query';
import { Button } from '@/shared/ui/button';
import {
  formatWorkoutDate,
  getWorkoutListErrorMessage,
  getWorkoutStatusLabel,
  WORKOUT_FILTERS,
  type WorkoutFilter,
  type WorkoutListItem,
} from '../lib/workouts-list';

type WorkoutsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; workouts: WorkoutListItem[]; total: number; totalPages: number };

export function WorkoutsList() {
  const t = useTranslations('web.workoutList');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<WorkoutFilter>('ALL');
  const [page, setPage] = useState(1);
  const query = useQuery(workoutListQueryOptions(filter, page));

  const unauthenticated =
    query.error instanceof WorkoutListRequestError && query.error.status === 401;

  useEffect(() => {
    if (unauthenticated) {
      queryClient.clear();
      router.replace('/login');
    }
  }, [unauthenticated, queryClient, router]);

  function selectFilter(next: WorkoutFilter) {
    setFilter(next);
    setPage(1);
  }

  function changePage(next: number) {
    setPage(next);
  }

  function retry() {
    void query.refetch();
  }

  const state: WorkoutsState = query.isPending
    ? { kind: 'loading' }
    : query.isError
      ? {
          kind: 'error',
          message:
            query.error instanceof WorkoutListRequestError
              ? query.error.message
              : getWorkoutListErrorMessage(),
        }
      : {
          kind: 'ready',
          workouts: query.data.workouts,
          total: query.data.total,
          totalPages: query.data.totalPages,
        };

  // No cached private content is rendered after the server responds with 401.
  if (unauthenticated) return null;

  return (
    <main className="mx-auto max-w-5xl space-y-7 px-6 py-12">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{t('journal')}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('description')}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button asChild>
          <Link href="/workouts/new">{t('create')}</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <label htmlFor="workout-status" className="block text-sm font-medium">
            {t('status')}
          </label>
          <select
            id="workout-status"
            value={filter}
            onChange={(event) => selectFilter(event.target.value as WorkoutFilter)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {WORKOUT_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {state.kind === 'ready' && (
          <p className="text-sm text-muted-foreground" role="status">
            {t('found', { count: state.total })}
          </p>
        )}
      </div>

      {state.kind === 'loading' && (
        <p role="status" className="rounded-xl border bg-card p-6 text-muted-foreground">
          {t('loading')}
        </p>
      )}

      {state.kind === 'error' && (
        <div role="alert" className="space-y-3 rounded-xl border bg-card p-6">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button type="button" variant="outline" onClick={retry}>
            {t('retry')}
          </Button>
        </div>
      )}

      {state.kind === 'ready' && state.workouts.length === 0 && (
        <section className="rounded-xl border bg-card p-8">
          <h2 className="font-semibold">{t('emptyTitle')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {filter === 'ALL'
              ? t('emptyAll')
              : t('emptyFilter')}
          </p>
        </section>
      )}

      {state.kind === 'ready' && state.workouts.length > 0 && (
        <section aria-label={t('list')} className="grid gap-4 sm:grid-cols-2">
          {state.workouts.map((workout) => (
            <article key={workout.id} className="space-y-3 rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">{workout.title}</h2>
                <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  {getWorkoutStatusLabel(workout.status)}
                </span>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t('date')}</dt>
                  <dd className="text-right">{formatWorkoutDate(workout.scheduledAt)}</dd>
                </div>
                {'exerciseCount' in workout && typeof workout.exerciseCount === 'number' && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{t('exercises')}</dt>
                    <dd>{workout.exerciseCount}</dd>
                  </div>
                )}
              </dl>
              <Link
                href={`/workouts/${workout.id}`}
                className="inline-block text-sm font-medium underline-offset-4 hover:underline"
              >
                {t('details')}
              </Link>
            </article>
          ))}
        </section>
      )}

      {state.kind === 'ready' && state.totalPages > 1 && (
        <nav aria-label={t('pages')} className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            type="button"
            disabled={page <= 1}
            onClick={() => changePage(page - 1)}
          >
            {t('back')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page', { page, total: state.totalPages })}
          </span>
          <Button
            variant="outline"
            type="button"
            disabled={page >= state.totalPages}
            onClick={() => changePage(page + 1)}
          >
            {t('next')}
          </Button>
        </nav>
      )}
    </main>
  );
}
