'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@gym/ui-web';

import { webApi } from '@/shared/api/client';
import { useAuthFailure } from '@/shared/api/use-auth-failure';

export class PersonalRecordsRequestError extends Error {
  constructor(readonly status?: number) {
    super(
      status === 429
        ? 'Забагато запитів. Спробуйте пізніше.'
        : 'Не вдалося завантажити особисті рекорди.',
    );
  }
}

export function personalRecordsQueryOptions() {
  return {
    queryKey: ['workout-analytics', 'personal-records'] as const,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      try {
        const { data, response } = await webApi.GET('/workout-analytics/personal-records', {
          signal,
        });
        if (response.status !== 200 || !data)
          throw new PersonalRecordsRequestError(response.status);
        return data;
      } catch (error) {
        if (error instanceof PersonalRecordsRequestError || signal.aborted) throw error;
        throw new PersonalRecordsRequestError();
      }
    },
    retry: false,
  };
}

/** Each count represents one current lifetime best for an exercise, not repeated record-break events. */
export function DashboardPersonalRecords() {
  const t = useTranslations('web.dashboard');
  const query = useQuery(personalRecordsQueryOptions());
  const onAuthFailure = useAuthFailure();

  useEffect(() => {
    if (query.error instanceof PersonalRecordsRequestError && query.error.status === 401) {
      onAuthFailure(query.error);
    }
  }, [onAuthFailure, query.error]);

  // An expired session must not leave historical private analytics visible.
  if (query.error instanceof PersonalRecordsRequestError && query.error.status === 401) return null;

  const loading = query.isPending || query.isFetching;

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('kpi.recordsTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('kpi.loading')}
          </p>
        ) : query.isError ? (
          <div role="alert" className="space-y-3">
            <p className="text-sm text-destructive">
              {t(
                query.error instanceof PersonalRecordsRequestError && query.error.status === 429
                  ? 'kpi.recordsErrorRateLimited'
                  : 'kpi.recordsErrorDefault',
              )}
            </p>
            <Button
              type="button"
              size="touch"
              variant="outline"
              aria-label={t('kpi.retryRecords')}
              onClick={() => void query.refetch()}
            >
              {t('kpi.retry')}
            </Button>
          </div>
        ) : Number.isInteger(query.data?.exerciseCount) &&
          (query.data?.exerciseCount ?? -1) >= 0 ? (
          <>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {query.data?.exerciseCount}
            </p>
            <p className="text-xs text-muted-foreground">{t('kpi.recordsDescription')}</p>
          </>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            {t('kpi.unavailable')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
