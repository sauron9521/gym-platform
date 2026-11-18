'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@gym/ui-web';

import { webApi } from '@/shared/api/client';
import { useAuthFailure } from '@/shared/api/use-auth-failure';

type Range = '7d' | '30d' | '90d';
const ranges: readonly Range[] = ['7d', '30d', '90d'];

class AnalyticsError extends Error {
  constructor(readonly status: number) {
    super(status === 429 ? 'Забагато запитів. Спробуйте пізніше.' : 'Не вдалося завантажити аналітику.');
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
  const max = Math.max(0, ...daily.map((day) => Number.isFinite(day.strengthVolumeKg) ? Math.max(0, day.strengthVolumeKg) : 0));
  const hasVolume = max > 0;

  return (
    <section aria-labelledby="dashboard-volume-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 id="dashboard-volume-heading" className="text-xl font-semibold tracking-tight">
            Прогрес тренувань
          </h2>
          <p className="text-sm text-muted-foreground">Силовий об’єм за днями за вибраний період.</p>
        </div>
        <div role="group" aria-label="Період графіка" className="flex gap-2">
          {ranges.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={range === option ? 'default' : 'outline'}
              aria-pressed={range === option}
              onClick={() => setRange(option)}
            >
              {option === '7d' ? '7 днів' : option === '30d' ? '30 днів' : '90 днів'}
            </Button>
          ))}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Тренувальний об’єм, кг</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(query.isPending || query.isFetching) && (
            <p role="status" className="text-sm text-muted-foreground">Завантажуємо графік…</p>
          )}
          {!query.isPending && !query.isFetching && query.isError && (
            <div role="alert" className="space-y-3">
              <p className="text-sm text-destructive">
                {query.error instanceof AnalyticsError ? query.error.message : 'Не вдалося завантажити аналітику.'}
              </p>
              <Button type="button" variant="outline" onClick={() => void query.refetch()}>
                Повторити
              </Button>
            </div>
          )}
          {ready && !hasVolume && (
            <p className="text-sm text-muted-foreground">За вибраний період немає записаного силового об’єму.</p>
          )}
          {ready && hasVolume && (
            <>
              <div className="flex h-44 items-end gap-px overflow-x-auto rounded-lg border border-border p-3" role="img" aria-label={`Графік силового об’єму за ${range === '7d' ? '7' : range === '30d' ? '30' : '90'} днів. Точні значення наведено нижче.`}>
                {daily.map((day) => (
                  <div key={day.date} className="flex h-full min-w-1 flex-1 items-end">
                    <div
                      className="w-full rounded-t-sm bg-primary"
                      style={{ height: `${Math.max(0, Math.min(100, (day.strengthVolumeKg / max) * 100))}%` }}
                      title={`${day.date}: ${Math.round(day.strengthVolumeKg)} кг`}
                    />
                  </div>
                ))}
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-primary">Переглянути точні значення за днями</summary>
                <ul className="mt-2 max-h-48 space-y-1 overflow-auto" aria-label="Денні значення об’єму">
                  {daily.map((day) => (
                    <li key={day.date} className="flex justify-between gap-3">
                      <time dateTime={day.date}>{day.date}</time>
                      <span className="tabular-nums">{Math.round(day.strengthVolumeKg)} кг</span>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
          {ready && (
            <p className="text-xs text-muted-foreground">
              Тренувань: {query.data.workoutCount}. Активних днів: {query.data.activeDays}. Дані API станом на{' '}
              {new Date(query.data.asOf).toLocaleDateString('uk-UA')}.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
