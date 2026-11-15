'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuthFailure } from '@/shared/api/use-auth-failure';
import {
  exerciseListQueryOptions,
  ExerciseListRequestError,
} from '@/features/exercises/api/exercise-list-query';
import { Button } from '@/shared/ui/button';
import type { ExerciseListItem } from '../lib/create-workout';

type PickerState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: ExerciseListItem[]; pages: number };

export function WorkoutExercisePicker({
  selectedIds,
  onSelect,
  disabled,
}: {
  selectedIds: readonly string[];
  onSelect: (exercise: ExerciseListItem) => void;
  disabled: boolean;
}) {
  const onAuthFailure = useAuthFailure();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const searching = search.trim() !== debouncedSearch;
  const query = useQuery({
    ...exerciseListQueryOptions({
      search: debouncedSearch,
      page,
      exerciseType: 'ALL',
      muscleGroup: '',
      equipment: '',
    }),
    enabled: !searching,
  });
  const unauthenticated =
    query.error instanceof ExerciseListRequestError && query.error.status === 401;

  useEffect(() => {
    if (query.error instanceof ExerciseListRequestError) {
      onAuthFailure(query.error);
    }
  }, [query.error, onAuthFailure]);

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updatePage(next: number) {
    setPage(next);
  }

  const state: PickerState =
    searching || query.isPending || query.isFetching || unauthenticated
      ? { kind: 'loading' }
      : query.isError
        ? {
            kind: 'error',
            message:
              query.error instanceof ExerciseListRequestError
                ? query.error.message
                : 'Каталог вправ недоступний.',
          }
        : { kind: 'ready', items: query.data.exercises, pages: query.data.pages };

  // Never expose cached private exercise entries after a 401.
  if (unauthenticated) return null;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="Каталог вправ">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Додати вправу</h2>
        <label htmlFor="exercise-search" className="block text-sm text-muted-foreground">
          Пошук за назвою
        </label>
        <input
          id="exercise-search"
          type="search"
          value={search}
          maxLength={100}
          disabled={disabled}
          onChange={(event) => updateSearch(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
      {state.kind === 'loading' && (
        <p role="status" className="text-sm text-muted-foreground">
          Шукаємо вправи…
        </p>
      )}
      {state.kind === 'error' && (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => void query.refetch()}
          >
            Повторити
          </Button>
        </div>
      )}
      {state.kind === 'ready' && (
        <>
          {state.items.length === 0 && (
            <p className="text-sm text-muted-foreground">Вправ не знайдено.</p>
          )}
          <ul className="space-y-2">
            {state.items.map((exercise) => {
              const selected = selectedIds.includes(exercise.id);
              return (
                <li key={exercise.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{exercise.name}</p>
                    <p className="text-xs text-muted-foreground">{exercise.exerciseType}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || selected}
                    onClick={() => onSelect(exercise)}
                  >
                    {selected ? 'Додано' : 'Додати'}
                  </Button>
                </li>
              );
            })}
          </ul>
          {state.pages > 1 && (
            <nav aria-label="Сторінки каталогу" className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={disabled || page <= 1}
                onClick={() => updatePage(page - 1)}
              >
                Назад
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {state.pages}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={disabled || page >= state.pages}
                onClick={() => updatePage(page + 1)}
              >
                Далі
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
