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
 * Read-only summary from the owner-scoped workouts API.
 * API pages are ordered by createdAt DESC, not scheduledAt: never claim this
 * is the user's nearest/upcoming workout or that a start action occurred.
 */
export function DashboardPlannedWorkouts() {
  const onAuthFailure = useAuthFailure();
  const query = useQuery(workoutListQueryOptions('PLANNED', 1));

  useEffect(() => {
    if (query.error instanceof WorkoutListRequestError) {
      onAuthFailure(query.error);
    }
  }, [query.error, onAuthFailure]);

  const unauthenticated =
    query.error instanceof WorkoutListRequestError && query.error.status === 401;
  const loading = query.isPending || query.isFetching;
  const workouts = query.data?.workouts ?? [];

  // A failed session check must never expose stale cached private records.
  if (unauthenticated) return null;

  return (
    <section aria-labelledby="dashboard-planned" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <h2 id="dashboard-planned" className="text-xl font-semibold tracking-tight">
            Заплановані тренування
          </h2>
          <p className="text-sm text-muted-foreground">Останні додані плани з твого журналу.</p>
        </div>
        {!loading && !query.isError && typeof query.data?.total === 'number' && (
          <p className="text-sm font-medium text-muted-foreground">
            Усього заплановано: {query.data.total}
          </p>
        )}
      </div>
      <Card>
        {loading && (
          <CardContent className="py-6 text-sm text-muted-foreground" role="status">
            Завантажуємо заплановані тренування…
          </CardContent>
        )}
        {!loading && query.isError && (
          <CardContent className="space-y-3 py-6" role="alert">
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
          <CardContent className="space-y-3 py-6">
            <p className="text-sm text-muted-foreground">Поки немає запланованих тренувань.</p>
            <Link
              href="/workouts/new"
              className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Створити тренування
            </Link>
          </CardContent>
        )}
        {!loading && !query.isError && workouts.length > 0 && (
          <CardContent className="py-2">
            <ul className="divide-y divide-border">
              {workouts.slice(0, 3).map((workout) => (
                <li
                  key={workout.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0 space-y-1">
                    <h3 className="break-words text-sm font-semibold">{workout.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      Заплановано: {formatWorkoutDate(workout.scheduledAt)}
                    </p>
                    {'exerciseCount' in workout && typeof workout.exerciseCount === 'number' && (
                      <p className="text-xs text-muted-foreground">
                        Вправ: {workout.exerciseCount}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/workouts/${workout.id}`}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Переглянути
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
      <Link
        href="/workouts"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Усі тренування
      </Link>
    </section>
  );
}
