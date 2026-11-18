'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Button, Card, CardContent } from '@gym/ui-web';

import {
  WorkoutListRequestError,
  workoutListQueryOptions,
} from '@/features/workouts/api/workouts-list-query';
import {
  formatWorkoutDate,
  getWorkoutListErrorMessage,
} from '@/features/workouts/lib/workouts-list';
import { useAuthFailure } from '@/shared/api/use-auth-failure';

/**
 * The API explicitly sorts completed summaries by completedAt DESC with
 * null completion timestamps last and a stable id tie-breaker.
 */
export function DashboardCompletedSessions() {
  const onAuthFailure = useAuthFailure();
  const query = useQuery(workoutListQueryOptions('COMPLETED', 1, 'completedAtDesc'));

  useEffect(() => {
    if (query.error instanceof WorkoutListRequestError) {
      onAuthFailure(query.error);
    }
  }, [query.error, onAuthFailure]);

  const unauthenticated =
    query.error instanceof WorkoutListRequestError && query.error.status === 401;
  const loading = query.isPending || query.isFetching;
  const workouts = query.data?.workouts ?? [];

  // Do not display cached private workouts after the API rejects the session.
  if (unauthenticated) return null;

  return (
    <section aria-labelledby="dashboard-completed" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <h2 id="dashboard-completed" className="text-xl font-semibold tracking-tight">
            Завершені тренування
          </h2>
          <p className="text-sm text-muted-foreground">
            Останні тренування за датою завершення.
          </p>
        </div>
        <Link
          href="/workouts"
          className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Відкрити журнал
        </Link>
      </div>

      <Card>
        {loading && (
          <CardContent role="status" className="py-6 text-sm text-muted-foreground">
            Завантажуємо завершені тренування…
          </CardContent>
        )}
        {!loading && query.isError && (
          <CardContent role="alert" className="space-y-3 py-6">
            <p className="text-sm text-destructive">
              {query.error instanceof WorkoutListRequestError
                ? query.error.message
                : getWorkoutListErrorMessage()}
            </p>
            <Button type="button" variant="outline" onClick={() => void query.refetch()}>
              Спробувати знову
            </Button>
          </CardContent>
        )}
        {!loading && !query.isError && workouts.length === 0 && (
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">Поки немає завершених тренувань.</p>
          </CardContent>
        )}
        {!loading && !query.isError && workouts.length > 0 && (
          <CardContent className="py-3">
            <ul className="space-y-3">
              {workouts.slice(0, 3).map((workout) => (
                <li
                  key={workout.id}
                  className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="break-words text-sm font-semibold">{workout.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      Завершено:{' '}
                      {workout.completedAt
                        ? formatWorkoutDate(workout.completedAt)
                        : 'Час завершення не вказано'}
                    </p>
                    {'exerciseCount' in workout && typeof workout.exerciseCount === 'number' && (
                      <p className="text-xs text-muted-foreground">
                        Вправ: {workout.exerciseCount}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/workouts/${workout.id}`}
                    className="inline-flex min-h-11 items-center self-start rounded-md px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:shrink-0 sm:self-auto"
                  >
                    Деталі
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    </section>
  );
}
