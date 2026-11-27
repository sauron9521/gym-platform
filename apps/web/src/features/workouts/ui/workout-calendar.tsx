'use client';

import { useEffect, useMemo, useState } from 'react';
import { workoutCalendarStatus, type WorkoutCalendarStatus } from '@gym/domain';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import {
  calendarMonthCells,
  calendarMonthStart,
  monthOf,
  groupByCalendarDay,
  shiftCalendarMonth,
  type CalendarMonth,
} from '@gym/datetime';
import { getWorkoutListErrorKey } from '../lib/workouts-list';
import { workoutCalendarQueryOptions, CalendarRequestError } from '../api/workout-calendar-query';
import { Button } from '@/shared/ui/button';

const weekdayKeys = [
  'weekdayMon',
  'weekdayTue',
  'weekdayWed',
  'weekdayThu',
  'weekdayFri',
  'weekdaySat',
  'weekdaySun',
] as const;
const statusKeys = {
  PLANNED: 'statusPlanned',
  IN_PROGRESS: 'statusInProgress',
  COMPLETED: 'statusCompleted',
  CANCELLED: 'statusCancelled',
  MISSED: 'statusMissed',
  COMPLETED_LATE: 'statusCompletedLate',
} as const satisfies Record<WorkoutCalendarStatus, string>;

export function WorkoutCalendar() {
  const t = useTranslations('web.workoutCalendar');
  const listT = useTranslations('web.workoutList');
  const locale = useLocale() === 'en' ? 'en' : 'uk';
  const router = useRouter();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState<CalendarMonth>(() => monthOf(new Date()));
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setNow(new Date().toISOString());
    };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const query = useQuery(workoutCalendarQueryOptions(month));
  const unauthenticated = query.error instanceof CalendarRequestError && query.error.status === 401;

  useEffect(() => {
    if (unauthenticated) {
      queryClient.clear();
      router.replace('/login');
    }
  }, [unauthenticated, queryClient, router]);

  const days = useMemo(
    () => groupByCalendarDay(query.data ?? [], (workout) => workout.scheduledAt),
    [query.data],
  );
  const cells = useMemo(() => calendarMonthCells(month), [month]);
  const heading = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'uk-UA', {
    month: 'long',
    year: 'numeric',
  }).format(calendarMonthStart(month));

  if (unauthenticated) return null;
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <Link href="/workouts" className="text-sm text-muted-foreground hover:underline">
        ← {t('back')}
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setMonth((value) => shiftCalendarMonth(value, -1))}
            aria-label={t('previous')}
          >
            ←
          </Button>
          <span aria-live="polite" className="min-w-36 text-center font-medium capitalize">
            {heading}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => setMonth((value) => shiftCalendarMonth(value, 1))}
            aria-label={t('next')}
          >
            →
          </Button>
        </div>
      </header>
      {query.isPending ? <p role="status">{t('loading')}</p> : null}
      {query.isError ? (
        <div role="alert" className="space-y-2 rounded-xl border p-4">
          <p>
            {query.error instanceof CalendarRequestError
              ? query.error.reason === 'tooMany'
                ? t('errorTooMany')
                : query.error.reason === 'incomplete'
                  ? t('errorIncomplete')
                  : listT(getWorkoutListErrorKey(query.error.status))
              : listT('errorDefault')}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t('retry')}
          </Button>
        </div>
      ) : null}
      {!query.isError && query.data && (
        <div
          className="grid grid-cols-7 gap-1 sm:gap-2"
          role="group"
          aria-label={`${t('title')}: ${heading}`}
        >
          {weekdayKeys.map((key) => (
            <div
              key={key}
              aria-hidden="true"
              className="p-2 text-center text-xs font-semibold text-muted-foreground"
            >
              {t(key)}
            </div>
          ))}
          {cells.map((cell) => (
            <div
              key={cell.key}
              role="group"
              aria-label={cell.key}
              className={`min-h-24 space-y-2 overflow-hidden rounded-lg border p-1 sm:min-h-32 sm:p-2 ${cell.inMonth ? 'bg-card' : 'bg-muted/30 text-muted-foreground'}`}
            >
              <span className="text-xs font-medium">{cell.date.getDate()}</span>
              {(days.get(cell.key) ?? []).map((workout) => {
                const status = workoutCalendarStatus(workout, now);
                return (
                  <Link
                    key={workout.id}
                    href={`/workouts/${workout.id}`}
                    className="block min-w-0 rounded-md bg-secondary px-1 py-1 text-[10px] font-medium break-words hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-2 sm:text-xs"
                    title={`${workout.title}: ${t(statusKeys[status])}`}
                  >
                    {workout.title}
                    {status === 'MISSED' || status === 'COMPLETED_LATE' ? (
                      <span className="block text-xs font-normal">{t(statusKeys[status])}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {!query.isError && query.data?.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('empty')}
        </p>
      )}
    </main>
  );
}
