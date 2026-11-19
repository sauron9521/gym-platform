'use client';

import { useEffect } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@gym/ui-web';

import {
  WorkoutListRequestError,
  workoutListQueryOptions,
} from '@/features/workouts/api/workouts-list-query';
import { useAuthFailure } from '@/shared/api/use-auth-failure';
import { DashboardPersonalRecords } from './dashboard-personal-records';
import { getDashboardWorkoutErrorKey } from '../lib/dashboard-workout-error';

/**
 * Read the API's owner-scoped total count for each supported status.
 * Reuse existing list query keys: the PLANNED count shares cache/fetches
 * with DashboardPlannedWorkouts rather than making a duplicate API request.
 */
export function DashboardWorkoutStats() {
  const t = useTranslations('web.dashboard');
  const format = useFormatter();
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
    { status: 'PLANNED', label: t('kpi.planned'), query: planned },
    { status: 'IN_PROGRESS', label: t('kpi.active'), query: active },
    { status: 'COMPLETED', label: t('kpi.completed'), query: completed },
  ] as const;

  return (
    <section aria-labelledby="dashboard-status-metrics" className="space-y-4">
      <div className="space-y-1">
        <h2 id="dashboard-status-metrics" className="text-xl font-semibold tracking-tight">
          {t('kpi.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('kpi.description')}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                    {t('kpi.loading')}
                  </p>
                ) : query.isError ? (
                  <div role="alert" className="space-y-3">
                    <p className="text-sm text-destructive">
                      {t(getDashboardWorkoutErrorKey(query.error))}
                    </p>
                    <Button
                      size="touch"
                      type="button"
                      variant="outline"
                      aria-label={t('kpi.retryStatus', { status: label.toLowerCase() })}
                      onClick={() => void query.refetch()}
                    >
                      {t('kpi.retry')}
                    </Button>
                  </div>
                ) : typeof query.data?.total === 'number' ? (
                  <p className="text-3xl font-semibold tracking-tight tabular-nums">
                    {format.number(query.data.total)}
                  </p>
                ) : (
                  <p role="status" className="text-sm text-muted-foreground">
                    {t('kpi.unavailable')}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
        <DashboardPersonalRecords />
      </div>
    </section>
  );
}
