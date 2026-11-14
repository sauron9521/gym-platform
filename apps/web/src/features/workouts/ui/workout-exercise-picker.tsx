'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';
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
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PickerState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void webApi
        .GET('/exercises', {
          params: {
            query: {
              page,
              limit: 20,
              ...(search.trim() ? { search: search.trim() } : {}),
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
            setState({
              kind: 'error',
              message:
                response.status === 429
                  ? 'Забагато запитів до каталогу. Спробуйте пізніше.'
                  : 'Не вдалося завантажити вправи.',
            });
            return;
          }
          setState({
            kind: 'ready',
            items: data.data.filter((exercise) => !exercise.isArchived),
            pages: Math.max(1, data.meta.totalPages),
          });
        })
        .catch(() => {
          if (active) setState({ kind: 'error', message: 'Каталог вправ недоступний.' });
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, page, attempt, router]);

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
    setState({ kind: 'loading' });
  }

  function updatePage(next: number) {
    setPage(next);
    setState({ kind: 'loading' });
  }

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
            onClick={() => {
              setState({ kind: 'loading' });
              setAttempt((value) => value + 1);
            }}
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
