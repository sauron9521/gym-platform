'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import {
  EXERCISE_TYPES,
  getExerciseErrorMessage,
  getExercisePageCount,
  getExerciseSourceLabel,
  getExerciseTypeLabel,
  type ExerciseListItem,
  type ExerciseTypeFilter,
} from '../lib/exercise-catalog';

import { useExerciseTaxonomy } from './use-exercise-taxonomy';

const PAGE_SIZE = 20;

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; exercises: ExerciseListItem[]; total: number; pages: number };

export function ExerciseCatalog({ role }: { role: 'ATHLETE' | 'TRAINER' | 'ADMIN' }) {
  const router = useRouter();
  const { state: taxonomy, retry: retryTaxonomy } = useExerciseTaxonomy();
  const [search, setSearch] = useState('');
  const [exerciseType, setExerciseType] = useState<ExerciseTypeFilter>('ALL');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [equipment, setEquipment] = useState('');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CatalogState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void webApi
        .GET('/exercises', {
          params: {
            query: {
              page,
              limit: PAGE_SIZE,
              ...(search.trim() ? { search: search.trim() } : {}),
              ...(exerciseType === 'ALL' ? {} : { exerciseType }),
              ...(muscleGroup.trim() ? { muscleGroup: muscleGroup.trim() } : {}),
              ...(equipment.trim() ? { equipment: equipment.trim() } : {}),
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
            setState({ kind: 'error', message: getExerciseErrorMessage(response.status) });
            return;
          }
          setState({
            kind: 'ready',
            exercises: data.data.filter((exercise) => !exercise.isArchived),
            total: data.meta.total,
            pages: getExercisePageCount(data.meta.totalPages),
          });
        })
        .catch(() => {
          if (active) setState({ kind: 'error', message: getExerciseErrorMessage() });
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, exerciseType, muscleGroup, equipment, page, attempt, router]);

  function resetAndFilter(action: () => void) {
    action();
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
        <p className="text-sm font-medium text-muted-foreground">Бібліотека вправ</p>
        <h1 className="text-3xl font-semibold tracking-tight">Каталог вправ</h1>
        <p className="text-sm text-muted-foreground">
          Переглядайте доступні вправи, їхні м’язові групи, обладнання та техніку виконання.
        </p>
      </header>

      {role !== 'ADMIN' && (
        <div>
          <Button asChild>
            <Link href="/exercises/new">Створити власну вправу</Link>
          </Button>
        </div>
      )}

      {taxonomy.kind === 'loading' && (
        <p role="status" className="text-sm text-muted-foreground">
          Завантажуємо довідники фільтрів…
        </p>
      )}
      {taxonomy.kind === 'error' && (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-destructive">{taxonomy.message}</p>
          <Button type="button" variant="outline" onClick={retryTaxonomy}>
            Повторити
          </Button>
        </div>
      )}

      <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="Фільтри вправ">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="exercise-search" className="block text-sm font-medium">
              Пошук за назвою
            </label>
            <input
              id="exercise-search"
              type="search"
              maxLength={100}
              value={search}
              onChange={(event) => resetAndFilter(() => setSearch(event.target.value))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="exercise-type" className="block text-sm font-medium">
              Тип вправи
            </label>
            <select
              id="exercise-type"
              value={exerciseType}
              onChange={(event) =>
                resetAndFilter(() => setExerciseType(event.target.value as ExerciseTypeFilter))
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {EXERCISE_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="exercise-muscle" className="block text-sm font-medium">
              Група м’язів
            </label>
            <select
              id="exercise-muscle"
              value={muscleGroup}
              disabled={taxonomy.kind !== 'ready'}
              onChange={(event) => resetAndFilter(() => setMuscleGroup(event.target.value))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Усі групи</option>
              {taxonomy.kind === 'ready' &&
                taxonomy.muscleGroups.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="exercise-equipment" className="block text-sm font-medium">
              Обладнання
            </label>
            <select
              id="exercise-equipment"
              value={equipment}
              disabled={taxonomy.kind !== 'ready'}
              onChange={(event) => resetAndFilter(() => setEquipment(event.target.value))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Усе обладнання</option>
              {taxonomy.kind === 'ready' &&
                taxonomy.equipment.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              resetAndFilter(() => {
                setSearch('');
                setExerciseType('ALL');
                setMuscleGroup('');
                setEquipment('');
              })
            }
          >
            Очистити фільтри
          </Button>
          {state.kind === 'ready' && (
            <p role="status" className="text-sm text-muted-foreground">
              Знайдено: {state.total}
            </p>
          )}
        </div>
      </section>

      {state.kind === 'loading' && (
        <p role="status" className="rounded-xl border bg-card p-6 text-muted-foreground">
          Завантажуємо вправи…
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

      {state.kind === 'ready' && state.exercises.length === 0 && (
        <section className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold">Вправ не знайдено</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Змініть параметри пошуку або очистьте фільтри.
          </p>
        </section>
      )}

      {state.kind === 'ready' && state.exercises.length > 0 && (
        <section aria-label="Список вправ" className="grid gap-4 sm:grid-cols-2">
          {state.exercises.map((exercise) => (
            <article key={exercise.id} className="space-y-3 rounded-xl border bg-card p-5">
              <div className="space-y-1">
                <h2 className="font-semibold">{exercise.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {getExerciseTypeLabel(exercise.exerciseType)} ·{' '}
                  {getExerciseSourceLabel(exercise.source)}
                </p>
              </div>
              {exercise.description && (
                <p className="line-clamp-3 text-sm text-muted-foreground">{exercise.description}</p>
              )}
              {exercise.muscleGroups.length > 0 && (
                <p className="text-sm">
                  <span className="font-medium">М’язи: </span>
                  {exercise.muscleGroups.map((item) => item.muscleGroup.name).join(', ')}
                </p>
              )}
              <Link
                href={`/exercises/${exercise.id}`}
                className="inline-block text-sm font-medium underline-offset-4 hover:underline"
              >
                Переглянути вправу
              </Link>
            </article>
          ))}
        </section>
      )}

      {state.kind === 'ready' && state.pages > 1 && (
        <nav aria-label="Сторінки вправ" className="flex items-center justify-between gap-4">
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
    </main>
  );
}
