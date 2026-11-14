'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import {
  formatWorkoutDate,
  getWorkoutListErrorMessage,
  getWorkoutPageCount,
  getWorkoutStatusLabel,
  WORKOUT_FILTERS,
  type WorkoutFilter,
  type WorkoutListItem,
} from '../lib/workouts-list';

const PAGE_SIZE = 10;

type WorkoutsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; workouts: WorkoutListItem[]; total: number; totalPages: number };

export function WorkoutsList() {
  const router = useRouter();
  const [filter, setFilter] = useState<WorkoutFilter>('ALL');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<WorkoutsState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ kind: 'loading' });

    void webApi
      .GET('/workouts', {
        params: {
          query: {
            page,
            limit: PAGE_SIZE,
            view: 'summary',
            ...(filter === 'ALL' ? {} : { status: filter }),
          },
        },
      })
      .then(({ data, response }) => {
        if (!active) return;

        if (response.status === 401) {
          router.replace('/login');
          return;
        }

        if (response.status !== 200 || !data) {
          setState({ kind: 'error', message: getWorkoutListErrorMessage(response.status) });
          return;
        }

        setState({
          kind: 'ready',
          workouts: data.data,
          total: data.meta.total,
          totalPages: getWorkoutPageCount(data.meta.totalPages),
        });
      })
      .catch(() => {
        if (active) setState({ kind: 'error', message: getWorkoutListErrorMessage() });
      });

    return () => {
      active = false;
    };
  }, [filter, page, attempt, router]);

  function selectFilter(next: WorkoutFilter) {
    setFilter(next);
    setPage(1);
    setState({ kind: 'loading' });
  }

  function changePage(next: number) {
    setPage(next);
    setState({ kind: 'loading' });
  }

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((current) => current + 1);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-7 px-6 py-12">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Тренувальний журнал</p>
        <h1 className="text-3xl font-semibold tracking-tight">Мої тренування</h1>
        <p className="text-sm text-muted-foreground">
          Переглядайте заплановані, поточні та завершені тренування.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <label htmlFor="workout-status" className="block text-sm font-medium">
            Статус
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
            Знайдено: {state.total}
          </p>
        )}
      </div>

      {state.kind === 'loading' && (
        <p role="status" className="rounded-xl border bg-card p-6 text-muted-foreground">
          Завантажуємо тренування…
        </p>
      )}

      {state.kind === 'error' && (
        <div role="alert" className="space-y-3 rounded-xl border bg-card p-6">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button type="button" variant="outline" onClick={retry}>
            Спробувати ще раз
          </Button>
        </div>
      )}

      {state.kind === 'ready' && state.workouts.length === 0 && (
        <section className="rounded-xl border bg-card p-8">
          <h2 className="font-semibold">Тренувань не знайдено</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {filter === 'ALL'
              ? 'Поки немає записів про тренування.'
              : 'За обраним статусом тренувань немає. Спробуйте інший фільтр.'}
          </p>
        </section>
      )}

      {state.kind === 'ready' && state.workouts.length > 0 && (
        <section aria-label="Список тренувань" className="grid gap-4 sm:grid-cols-2">
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
                  <dt className="text-muted-foreground">Дата</dt>
                  <dd className="text-right">{formatWorkoutDate(workout.scheduledAt)}</dd>
                </div>
                {'exerciseCount' in workout && typeof workout.exerciseCount === 'number' && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Вправ</dt>
                    <dd>{workout.exerciseCount}</dd>
                  </div>
                )}
              </dl>
            </article>
          ))}
        </section>
      )}

      {state.kind === 'ready' && state.totalPages > 1 && (
        <nav aria-label="Сторінки тренувань" className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            type="button"
            disabled={page <= 1}
            onClick={() => changePage(page - 1)}
          >
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            Сторінка {page} із {state.totalPages}
          </span>
          <Button
            variant="outline"
            type="button"
            disabled={page >= state.totalPages}
            onClick={() => changePage(page + 1)}
          >
            Далі
          </Button>
        </nav>
      )}
    </main>
  );
}
