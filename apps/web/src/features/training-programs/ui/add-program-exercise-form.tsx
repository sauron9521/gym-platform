'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { webApi } from '@/shared/api/client';
import {
  exerciseListQueryOptions,
  ExerciseListRequestError,
} from '../../exercises/api/exercise-list-query';
import { Button } from '@/shared/ui/button';
import type { ProgramVersionWithWorkouts } from '../lib/create-program-workout';
import {
  addProgramExerciseSchema,
  buildAddProgramExercisePayload,
  getAddProgramExerciseError,
  getProgramExerciseListError,
  isProgramExerciseSelectable,
  type AddProgramExerciseValues,
  type ProgramExerciseOption,
} from '../lib/add-program-exercise';

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: ProgramExerciseOption[]; pages: number };

export function AddProgramExerciseForm({
  programId,
  versionId,
  workoutId,
  workoutTitle,
  existingExerciseIds,
  onAdded,
  onCancel,
}: {
  programId: string;
  versionId: string;
  workoutId: string;
  workoutTitle: string;
  existingExerciseIds: readonly string[];
  onAdded: (version: ProgramVersionWithWorkouts) => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const redirecting = useRef(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ProgramExerciseOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<AddProgramExerciseValues>({
    resolver: zodResolver(addProgramExerciseSchema),
    defaultValues: { exerciseId: '', notes: '' },
    mode: 'onSubmit',
  });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const searching = search.trim() !== debouncedSearch;
  const query = useQuery({
    ...exerciseListQueryOptions({
      search: debouncedSearch,
      exerciseType: 'ALL',
      muscleGroup: '',
      equipment: '',
      page,
    }),
    enabled: !searching,
    staleTime: 30_000,
  });
  const unauthenticated =
    query.error instanceof ExerciseListRequestError && query.error.status === 401;

  useEffect(() => {
    if (unauthenticated && !redirecting.current) {
      redirecting.current = true;
      queryClient.clear();
      router.replace('/login');
    }
  }, [unauthenticated, queryClient, router]);

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function changePage(next: number) {
    setPage(next);
  }

  function retry() {
    void query.refetch();
  }

  let catalog: CatalogState;
  if (searching || query.isPending || unauthenticated) {
    catalog = { kind: 'loading' };
  } else if (query.isError) {
    catalog = {
      kind: 'error',
      message: getProgramExerciseListError(
        query.error instanceof ExerciseListRequestError ? query.error.status : undefined,
      ),
    };
  } else {
    catalog = {
      kind: 'ready',
      items: query.data.exercises.filter(
        (exercise) => exercise.source === 'GLOBAL' || exercise.source === 'TRAINER_CUSTOM',
      ),
      pages: query.data.pages,
    };
  }

  // A failed session must never expose a cached private exercise list.
  if (unauthenticated) return null;

  async function submit(values: AddProgramExerciseValues) {
    setError(null);
    if (
      !selected ||
      selected.id !== values.exerciseId ||
      !isProgramExerciseSelectable(selected, existingExerciseIds)
    ) {
      form.setError('exerciseId', { message: 'Оберіть доступну вправу з каталогу.' });
      return;
    }

    try {
      const { response, data } = await webApi.POST(
        '/training-programs/{programId}/versions/{versionId}/workouts/{workoutId}/exercises',
        {
          params: { path: { programId, versionId, workoutId } },
          body: buildAddProgramExercisePayload(values),
        },
      );
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (response.status !== 201 || !data) {
        setError(getAddProgramExerciseError(response.status));
        return;
      }
      onAdded(data);
    } catch {
      setError(getAddProgramExerciseError());
    }
  }

  return (
    <form
      aria-label={`Додавання вправи до тренування ${workoutTitle}`}
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
      noValidate
      className="space-y-4 rounded-lg border p-4"
    >
      <h4 className="font-semibold">Додати вправу до дня</h4>
      <div className="space-y-1">
        <label
          htmlFor={`program-exercise-search-${workoutId}`}
          className="block text-sm font-medium"
        >
          Пошук вправи
        </label>
        <input
          id={`program-exercise-search-${workoutId}`}
          type="search"
          maxLength={100}
          value={search}
          disabled={isSubmitting}
          onChange={(event) => updateSearch(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
      {catalog.kind === 'loading' && (
        <p role="status" className="text-sm text-muted-foreground">
          Завантажуємо каталог…
        </p>
      )}
      {catalog.kind === 'error' && (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-destructive">{catalog.message}</p>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={retry}>
            Повторити пошук
          </Button>
        </div>
      )}
      {catalog.kind === 'ready' && (
        <>
          {catalog.items.length === 0 && (
            <p className="text-sm text-muted-foreground">Доступних вправ не знайдено.</p>
          )}
          <ul className="max-h-64 space-y-2 overflow-auto" aria-label="Результати пошуку вправ">
            {catalog.items.map((exercise) => {
              const available = isProgramExerciseSelectable(exercise, existingExerciseIds);
              return (
                <li key={exercise.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm">{exercise.name}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting || !available}
                    aria-label={`Обрати вправу ${exercise.name}`}
                    onClick={() => {
                      setSelected(exercise);
                      form.setValue('exerciseId', exercise.id, { shouldValidate: true });
                      setError(null);
                    }}
                  >
                    {!available ? 'Вже є' : selected?.id === exercise.id ? 'Обрано' : 'Обрати'}
                  </Button>
                </li>
              );
            })}
          </ul>
          {catalog.pages > 1 && (
            <nav
              aria-label="Сторінки вправ для програми"
              className="flex items-center justify-between gap-2"
            >
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || page <= 1}
                onClick={() => changePage(page - 1)}
              >
                Назад
              </Button>
              <span className="text-sm">
                {page} / {catalog.pages}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || page >= catalog.pages}
                onClick={() => changePage(page + 1)}
              >
                Далі
              </Button>
            </nav>
          )}
        </>
      )}
      <p className="text-sm">Обрана вправа: {selected?.name ?? 'не обрана'}</p>
      {errors.exerciseId && (
        <p role="alert" className="text-sm text-destructive">
          {errors.exerciseId.message}
        </p>
      )}
      <div className="space-y-1">
        <label
          htmlFor={`program-exercise-notes-${workoutId}`}
          className="block text-sm font-medium"
        >
          Примітки до вправи (необов’язково)
        </label>
        <textarea
          id={`program-exercise-notes-${workoutId}`}
          rows={2}
          maxLength={5000}
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.notes)}
          {...form.register('notes')}
          className="w-full rounded-md border border-input bg-background p-3 text-sm"
        />
        {errors.notes && (
          <p role="alert" className="text-sm text-destructive">
            {errors.notes.message}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting || !selected}>
          {isSubmitting ? 'Додаємо…' : 'Додати обрану вправу'}
        </Button>
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
          Скасувати додавання
        </Button>
      </div>
    </form>
  );
}
