'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@gym/ui-web';

import {
  WorkoutListRequestError,
  workoutListQueryOptions,
} from '@/features/workouts/api/workouts-list-query';
import { getWorkoutListErrorMessage } from '@/features/workouts/lib/workouts-list';
import { useAuthFailure } from '@/shared/api/use-auth-failure';

/**
 * Read the API's owner-scoped total count for each supported status.
 * Reuse existing list query keys: the PLANNED count shares cache/fetches
 * with DashboardPlannedWorkouts rather than making a duplicate API request.
 */
export function DashboardWorkoutStats() {
  const onAuthFailure = useAuthFailure();
  const planned = useQuery(workoutListQueryOptions('PLANNED', 1));
  const active = useQuery(workoutListQueryOptions('IN_PROGRESS', 1));
  const completed = useQuery(workoutListQueryOptions('COMPLETED', 1));

  const authError = [planned.error, active.error, completed.error].find(
    (error) => error instanceof WorkoutListRequestError && error.status === 401,
  );

  useEffect(() => {
    if (authError instanceof WorkoutListRequestError) onAuthFailure(authError);
  }, [authError, onAuthFailure]);

  // Never show any cached private KPI count after an unauthorized response.
  if (authError) return null;

  const metrics = [
    { status: 'PLANNED', label: 'Заплановані', query: planned },
    { status: 'IN_PROGRESS', label: 'У процесі', query: active },
    { status: 'COMPLETED', label: 'Завершені', query: completed },
  ] as const;

  return (
    <section aria-labelledby="dashboard-status-metrics" className="space-y-4">
      <div className="space-y-1">
        <h2 id="dashboard-status-metrics" className="text-xl font-semibold tracking-tight">
          Мої тренування в цифрах
        </h2>
        <p className="text-sm text-muted-foreground">
          Кількість за статусом за весь час. Скасовані не враховуються.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {metrics.map(({ status, label, query }) => {
          const loading = query.isPending || query.isFetching;

          return (
            <Card key={status} className="min-w-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    Завантажуємо…
                  </p>
                ) : query.isError ? (
                  <div role="alert" className="space-y-3">
                    <p className="text-sm text-destructive">
                      {query.error instanceof WorkoutListRequestError
                        ? query.error.message
                        : getWorkoutListErrorMessage()}
                    </p>
                    <Button
                      size="touch"
                      type="button"
                      variant="outline"
                      aria-label={`Повторити завантаження: ${label.toLowerCase()}`}
                      onClick={() => void query.refetch()}
                    >
                      Повторити
                    </Button>
                  </div>
                ) : typeof query.data?.total === 'number' ? (
                  <p className="text-3xl font-semibold tracking-tight tabular-nums">
                    {query.data.total}
                  </p>
                ) : (
                  <p role="status" className="text-sm text-muted-foreground">
                    Дані недоступні
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
