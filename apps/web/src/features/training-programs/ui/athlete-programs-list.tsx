'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import {
  ASSIGNMENT_STATUSES,
  formatProgramDate,
  getAssignmentStatusLabel,
  getProgramListError,
  getProgramPageCount,
  type AssignmentStatusFilter,
  type TrainingAssignmentItem,
} from '../lib/training-programs-list';

const PAGE_SIZE = 20;

type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; assignments: TrainingAssignmentItem[]; total: number; pages: number };

export function AthleteProgramsList() {
  const router = useRouter();
  const [status, setStatus] = useState<AssignmentStatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ListState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    void webApi
      .GET('/training-programs/assignments', {
        params: {
          query: {
            page,
            limit: PAGE_SIZE,
            view: 'summary',
            ...(status === 'ALL' ? {} : { status }),
          },
        },
      })
      .then(({ response, data }) => {
        if (!active) return;
        if (response.status === 401) {
          router.replace('/login');
          return;
        }
        if (response.status !== 200 || !data) {
          setState({ kind: 'error', message: getProgramListError(response.status) });
          return;
        }
        setState({
          kind: 'ready',
          assignments: data.data,
          total: data.meta.total,
          pages: getProgramPageCount(data.meta.totalPages),
        });
      })
      .catch(() => {
        if (active) setState({ kind: 'error', message: getProgramListError() });
      });

    return () => {
      active = false;
    };
  }, [status, page, attempt, router]);

  function changeStatus(next: AssignmentStatusFilter) {
    setStatus(next);
    setPage(1);
    setState({ kind: 'loading' });
  }

  function changePage(next: number) {
    setPage(next);
    setState({ kind: 'loading' });
  }

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((value) => value + 1);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-7 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Кабінет атлета</p>
        <h1 className="text-3xl font-semibold tracking-tight">Мої програми</h1>
        <p className="text-sm text-muted-foreground">
          Призначені тренером версії та історія виконання програм.
        </p>
      </header>

      <section className="space-y-2 rounded-xl border bg-card p-5" aria-label="Фільтри призначень">
        <label htmlFor="training-assignment-status" className="block text-sm font-medium">
          Статус призначення
        </label>
        <select
          id="training-assignment-status"
          value={status}
          onChange={(event) => changeStatus(event.target.value as AssignmentStatusFilter)}
          className="h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
        >
          {ASSIGNMENT_STATUSES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </section>

      {state.kind === 'loading' && (
        <p role="status" className="rounded-xl border bg-card p-6 text-muted-foreground">
          Завантажуємо призначення…
        </p>
      )}

      {state.kind === 'error' && (
        <section role="alert" className="space-y-3 rounded-xl border bg-card p-6">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button type="button" variant="outline" onClick={retry}>
            Спробувати ще раз
          </Button>
        </section>
      )}

      {state.kind === 'ready' && (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            Усього призначень: {state.total}
          </p>
          {state.assignments.length === 0 ? (
            <section className="rounded-xl border bg-card p-6">
              <h2 className="font-semibold">Немає призначених програм</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Програми з обраним статусом ще не призначені.
              </p>
            </section>
          ) : (
            <section aria-label="Призначені програми" className="grid gap-4 sm:grid-cols-2">
              {state.assignments.map((assignment) => (
                <article key={assignment.id} className="space-y-3 rounded-xl border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold">{assignment.version.title}</h2>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                      {getAssignmentStatusLabel(assignment.status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Версія {assignment.version.version} · Призначено:{' '}
                    {formatProgramDate(assignment.assignedAt)}
                  </p>
                  {assignment.version.description && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {assignment.version.description}
                    </p>
                  )}
                  {assignment.version.durationWeeks !== null && (
                    <p className="text-sm">Тривалість: {assignment.version.durationWeeks} тиж.</p>
                  )}
                  {assignment.completedAt && (
                    <p className="text-sm text-muted-foreground">
                      Завершено: {formatProgramDate(assignment.completedAt)}
                    </p>
                  )}
                  {assignment.endedAt && (
                    <p className="text-sm text-muted-foreground">
                      Припинено: {formatProgramDate(assignment.endedAt)}
                    </p>
                  )}
                </article>
              ))}
            </section>
          )}
          <div className="text-sm">
            <Link href="/workouts" className="font-medium underline-offset-4 hover:underline">
              Перейти до моїх тренувань
            </Link>
          </div>
          {state.pages > 1 && (
            <nav
              aria-label="Сторінки призначених програм"
              className="flex items-center justify-between gap-4"
            >
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
              >
                Назад
              </Button>
              <span className="text-sm text-muted-foreground">
                Сторінка {page} із {state.pages}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={page >= state.pages}
                onClick={() => changePage(page + 1)}
              >
                Далі
              </Button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
