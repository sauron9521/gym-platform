'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { exerciseListQueryOptions, ExerciseListRequestError } from '../api/exercise-list-query';
import { Button } from '@/shared/ui/button';
import {
  EXERCISE_TYPES,
  getExerciseErrorMessage,
  getExerciseSourceLabel,
  getExerciseTypeLabel,
  type ExerciseListItem,
  type ExerciseTypeFilter,
} from '../lib/exercise-catalog';

import { useExerciseTaxonomy } from './use-exercise-taxonomy';

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; exercises: ExerciseListItem[]; total: number; pages: number };

export function ExerciseCatalog({ role }: { role: 'ATHLETE' | 'TRAINER' | 'ADMIN' }) {
  const t = useTranslations('web.exerciseCatalog');
  const router = useRouter();
  const queryClient = useQueryClient();
  const redirecting = useRef(false);
  const { state: taxonomy, retry: retryTaxonomy } = useExerciseTaxonomy();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [exerciseType, setExerciseType] = useState<ExerciseTypeFilter>('ALL');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [equipment, setEquipment] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const searching = search.trim() !== debouncedSearch;
  const query = useQuery({
    ...exerciseListQueryOptions({
      search: debouncedSearch,
      exerciseType,
      muscleGroup,
      equipment,
      page,
    }),
    enabled: !searching,
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

  function resetAndFilter(action: () => void) {
    action();
    setPage(1);
  }

  function changePage(next: number) {
    setPage(next);
  }

  function retry() {
    void query.refetch();
  }

  const state: CatalogState =
    searching || query.isPending
      ? { kind: 'loading' }
      : query.isError
        ? {
            kind: 'error',
            message:
              query.error instanceof ExerciseListRequestError
                ? query.error.message
                : getExerciseErrorMessage(),
          }
        : {
            kind: 'ready',
            exercises: query.data.exercises,
            total: query.data.total,
            pages: query.data.pages,
          };

  // Do not expose cached private results after an authentication failure.
  if (unauthenticated) return null;

  return (
    <main className="mx-auto max-w-5xl space-y-7 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{t('library')}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('description')}
        </p>
      </header>

      {role !== 'ADMIN' && (
        <div>
          <Button asChild>
            <Link href="/exercises/new">{t('new')}</Link>
          </Button>
        </div>
      )}

      {taxonomy.kind === 'loading' && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('loadingFilters')}
        </p>
      )}
      {taxonomy.kind === 'error' && (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-destructive">{taxonomy.message}</p>
          <Button type="button" variant="outline" onClick={retryTaxonomy}>
            {t('retry')}
          </Button>
        </div>
      )}

      <section className="space-y-4 rounded-xl border bg-card p-5" aria-label={t('filters')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="exercise-search" className="block text-sm font-medium">
              {t('search')}
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
              {t('type')}
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
              {t('muscle')}
            </label>
            <select
              id="exercise-muscle"
              value={muscleGroup}
              disabled={taxonomy.kind !== 'ready'}
              onChange={(event) => resetAndFilter(() => setMuscleGroup(event.target.value))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('allMuscles')}</option>
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
              {t('equipment')}
            </label>
            <select
              id="exercise-equipment"
              value={equipment}
              disabled={taxonomy.kind !== 'ready'}
              onChange={(event) => resetAndFilter(() => setEquipment(event.target.value))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('allEquipment')}</option>
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
            {t('clear')}
          </Button>
          {state.kind === 'ready' && (
            <p role="status" className="text-sm text-muted-foreground">
              {t('found', { count: state.total })}
            </p>
          )}
        </div>
      </section>

      {state.kind === 'loading' && (
        <p role="status" className="rounded-xl border bg-card p-6 text-muted-foreground">
          {t('loading')}
        </p>
      )}

      {state.kind === 'error' && (
        <div role="alert" className="space-y-3 rounded-xl border bg-card p-6">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button type="button" variant="outline" onClick={retry}>
            {t('retryAgain')}
          </Button>
        </div>
      )}

      {state.kind === 'ready' && state.exercises.length === 0 && (
        <section className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold">{t('empty')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('emptyHint')}
          </p>
        </section>
      )}

      {state.kind === 'ready' && state.exercises.length > 0 && (
        <section aria-label={t('list')} className="grid gap-4 sm:grid-cols-2">
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
                  <span className="font-medium">{t('muscles')}</span>
                  {exercise.muscleGroups.map((item) => item.muscleGroup.name).join(', ')}
                </p>
              )}
              <Link
                href={`/exercises/${exercise.id}`}
                className="inline-block text-sm font-medium underline-offset-4 hover:underline"
              >
                {t('details')}
              </Link>
            </article>
          ))}
        </section>
      )}

      {state.kind === 'ready' && state.pages > 1 && (
        <nav aria-label={t('pages')} className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => changePage(page - 1)}
          >
            {t('back')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page', { page, total: state.pages })}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page >= state.pages}
            onClick={() => changePage(page + 1)}
          >
            {t('next')}
          </Button>
        </nav>
      )}
    </main>
  );
}
