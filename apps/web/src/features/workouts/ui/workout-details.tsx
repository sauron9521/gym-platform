'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { useAuthFailure } from '@/shared/api/use-auth-failure';
import { Button } from '@/shared/ui/button';
import {
  workoutDetailsQueryOptions,
  WorkoutDetailsRequestError,
} from '../api/workout-details-query';
import { WorkoutActions } from './workout-actions';
import { EditWorkoutForm } from './edit-workout-form';
import { WorkoutExercises } from './workout-exercises';
import { SetMetric } from './workout-set-metric';
import { getWorkoutDetailsErrorMessage, type WorkoutDetailsData } from '../lib/workout-details';
import { formatWorkoutDate, getWorkoutStatusLabel } from '../lib/workouts-list';

type DetailsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; workout: WorkoutDetailsData };

export function WorkoutDetails({ id }: { id: string }) {
  const onAuthFailure = useAuthFailure();
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editingWorkout, setEditingWorkout] = useState(false);
  const query = useQuery(workoutDetailsQueryOptions(id));
  const unauthenticated =
    query.error instanceof WorkoutDetailsRequestError && query.error.status === 401;

  useEffect(() => {
    if (query.error instanceof WorkoutDetailsRequestError) {
      onAuthFailure(query.error);
    }
  }, [query.error, onAuthFailure]);

  function retry() {
    setEditingWorkout(false);
    setEditingSetId(null);
    void query.refetch();
  }

  let state: DetailsState;
  if (query.isPending || query.isFetching || unauthenticated) {
    state = { kind: 'loading' };
  } else if (query.isError) {
    state = {
      kind: 'error',
      message:
        query.error instanceof WorkoutDetailsRequestError
          ? query.error.message
          : getWorkoutDetailsErrorMessage(),
    };
  } else {
    state = { kind: 'ready', workout: query.data };
  }

  // Do not render cached private workout data after an HTTP 401.
  if (unauthenticated) return null;

  return (
    <main className="mx-auto min-w-0 max-w-5xl space-y-6 px-4 py-6 sm:space-y-7 sm:px-6 sm:py-10">
      <Link
        href="/workouts"
        className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        ← Усі тренування
      </Link>

      {state.kind === 'loading' && (
        <p role="status" className="rounded-xl border bg-card p-6 text-muted-foreground">
          Завантажуємо деталі тренування…
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

      {state.kind === 'ready' && (
        <>
          <header className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-3xl">
                {state.workout.title}
              </h1>
              <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {getWorkoutStatusLabel(state.workout.status)}
              </span>
              {state.workout.status === 'PLANNED' && !editingWorkout && (
                <Button type="button" variant="outline" onClick={() => setEditingWorkout(true)}>
                  Редагувати
                </Button>
              )}
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-3 [&>div]:min-w-0 [&>div]:rounded-lg [&>div]:bg-muted/40 [&>div]:p-3">
              <SetMetric label="Заплановано" value={formatWorkoutDate(state.workout.scheduledAt)} />
              <SetMetric label="Початок" value={formatWorkoutDate(state.workout.startedAt)} />
              <SetMetric label="Завершення" value={formatWorkoutDate(state.workout.completedAt)} />
            </dl>
            {state.workout.notes && (
              <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {state.workout.notes}
              </p>
            )}
          </header>

          {editingWorkout && state.workout.status === 'PLANNED' && (
            <EditWorkoutForm
              workout={state.workout}
              onSaved={() => setEditingWorkout(false)}
              onCancel={() => setEditingWorkout(false)}
              onReload={retry}
            />
          )}

          {!editingWorkout && <WorkoutActions workout={state.workout} onReload={retry} />}

          <WorkoutExercises
            workout={state.workout}
            editingSetId={editingSetId}
            onEditSet={setEditingSetId}
          />
        </>
      )}
    </main>
  );
}
