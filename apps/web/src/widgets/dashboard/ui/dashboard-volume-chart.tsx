'use client';

import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@gym/ui-web';

import { webApi } from '@/shared/api/client';
import { useAuthFailure } from '@/shared/api/use-auth-failure';

type Range = '7d' | '30d' | '90d';
const ranges: readonly Range[] = ['7d', '30d', '90d'];
const rangeLabelKeys = {
  '7d': 'volumeChart.range7',
  '30d': 'volumeChart.range30',
  '90d': 'volumeChart.range90',
} as const;

export class AnalyticsError extends Error {
  constructor(readonly status: number) {
    super('Workout analytics request failed');
  }
}

function summaryOptions(range: Range) {
  return {
    queryKey: ['workout-analytics', 'summary', range] as const,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      try {
        const { data, response } = await webApi.GET('/workout-analytics/summary', {
          params: { query: { range } },
          signal,
        });
        if (response.status !== 200 || !data) throw new AnalyticsError(response.status);
        return data;
      } catch (error) {
        if (error instanceof AnalyticsError || signal.aborted) throw error;
        throw new AnalyticsError(0);
      }
    },
    retry: false,
  };
}

/** Owner-scoped daily strength volume, sourced exclusively from the existing analytics endpoint. */
export function DashboardVolumeChart() {
  const t = useTranslations('web.dashboard');
  const format = useFormatter();
  const [range, setRange] = useState<Range>('30d');
  const onAuthFailure = useAuthFailure();
  const query = useQuery(summaryOptions(range));

  useEffect(() => {
    if (query.error instanceof AnalyticsError) onAuthFailure(query.error);
  }, [onAuthFailure, query.error]);

  if (query.error instanceof AnalyticsError && query.error.status === 401) return null;

  // Keep prior-range private data hidden until the selected range is confirmed.
  const ready = !query.isPending && !query.isFetching && !query.isError && query.data;
  const daily = ready ? query.data.daily : [];
  const max = Math.max(
    0,
    ...daily.map((day) =>
      Number.isFinite(day.strengthVolumeKg) ? Math.max(0, day.strengthVolumeKg) : 0,
    ),
  );
  const hasVolume = max > 0;
  const rangeDays = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  // Date-only values represent calendar days; pin them to UTC to avoid
  // shifting a workout to the previous or next date in the user's timezone.
  const formatDay = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00.000Z`), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });

  return (
    <section aria-labelledby="dashboard-volume-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 id="dashboard-volume-heading" className="text-xl font-semibold tracking-tight">
            {t('volumeChart.heading')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('volumeChart.description')}</p>
        </div>
        <div role="group" aria-label={t('volumeChart.periodLabel')} className="flex gap-2">
          {ranges.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={range === option ? 'default' : 'outline'}
              aria-pressed={range === option}
              onClick={() => setRange(option)}
            >
              {t(rangeLabelKeys[option])}
            </Button>
          ))}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('volumeChart.volumeLabel')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(query.isPending || query.isFetching) && (
            <p role="status" className="text-sm text-muted-foreground">
              {t('volumeChart.loading')}
            </p>
          )}
          {!query.isPending && !query.isFetching && query.isError && (
            <div role="alert" className="space-y-3">
              <p className="text-sm text-destructive">
                {t(
                  query.error instanceof AnalyticsError && query.error.status === 429
                    ? 'volumeChart.errorRateLimited'
                    : 'volumeChart.errorDefault',
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                aria-label={t('volumeChart.retryAccessible')}
                onClick={() => void query.refetch()}
              >
                {t('volumeChart.retry')}
              </Button>
            </div>
          )}
          {ready && !hasVolume && (
            <p className="text-sm text-muted-foreground">{t('volumeChart.empty')}</p>
          )}
          {ready && hasVolume && (
            <>
              <div
                className="flex h-44 items-end gap-px overflow-x-auto rounded-lg border border-border p-3"
                role="img"
                aria-label={t('volumeChart.chartAccessible', { days: rangeDays })}
              >
                {daily.map((day) => (
                  <div key={day.date} className="flex h-full min-w-1 flex-1 items-end">
                    <div
                      className="w-full rounded-t-sm bg-primary"
                      style={{
                        height: `${Math.max(0, Math.min(100, (day.strengthVolumeKg / max) * 100))}%`,
                      }}
                      title={t('volumeChart.pointTitle', {
                        date: formatDay(day.date),
                        volume: Math.round(day.strengthVolumeKg),
                      })}
                    />
                  </div>
                ))}
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-primary">
                  {t('volumeChart.showValues')}
                </summary>
                <ul
                  className="mt-2 max-h-48 space-y-1 overflow-auto"
                  aria-label={t('volumeChart.dailyValues')}
                >
                  {daily.map((day) => (
                    <li key={day.date} className="flex justify-between gap-3">
                      <time dateTime={day.date}>{formatDay(day.date)}</time>
                      <span className="tabular-nums">
                        {t('volumeChart.volumeKg', { volume: Math.round(day.strengthVolumeKg) })}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
          {ready && (
            <p className="text-xs text-muted-foreground">
              {t('volumeChart.summary', {
                workouts: query.data.workoutCount,
                activeDays: query.data.activeDays,
                date: format.dateTime(new Date(query.data.asOf), {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }),
              })}
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
