'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { WorkoutActions } from './workout-actions';
import { WorkoutSetForm } from './workout-set-form';
import {
  formatWorkoutValue,
  getWorkoutDetailsErrorMessage,
  getWorkoutSetStatusLabel,
  getWorkoutSetTypeLabel,
  type WorkoutDetailsData,
} from '../lib/workout-details';
import { formatWorkoutDate, getWorkoutStatusLabel } from '../lib/workouts-list';

type DetailsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; workout: WorkoutDetailsData };

function SetMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export function WorkoutDetails({ id }: { id: string }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [state, setState] = useState<DetailsState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    void webApi
      .GET('/workouts/{id}', { params: { path: { id } } })
      .then(({ data, response }) => {
        if (!active) return;
        if (response.status === 401) {
          router.replace('/login');
          return;
        }
        if (response.status !== 200 || !data) {
          setState({ kind: 'error', message: getWorkoutDetailsErrorMessage(response.status) });
          return;
        }
        setState({ kind: 'ready', workout: data });
      })
      .catch(() => {
        if (active) setState({ kind: 'error', message: getWorkoutDetailsErrorMessage() });
      });

    return () => {
      active = false;
    };
  }, [id, attempt, router]);

  function retry() {
    setEditingSetId(null);
    setState({ kind: 'loading' });
    setAttempt((current) => current + 1);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-7 px-6 py-12">
      <Link href="/workouts" className="text-sm text-muted-foreground hover:underline">
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
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">{state.workout.title}</h1>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                {getWorkoutStatusLabel(state.workout.status)}
              </span>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <SetMetric label="Заплановано" value={formatWorkoutDate(state.workout.scheduledAt)} />
              <SetMetric label="Початок" value={formatWorkoutDate(state.workout.startedAt)} />
              <SetMetric label="Завершення" value={formatWorkoutDate(state.workout.completedAt)} />
            </dl>
            {state.workout.notes && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {state.workout.notes}
              </p>
            )}
          </header>

          <WorkoutActions
            workout={state.workout}
            onUpdated={(workout) => setState({ kind: 'ready', workout })}
            onReload={retry}
          />

          <section className="space-y-4" aria-label="Вправи тренування">
            <h2 className="text-xl font-semibold">Вправи ({state.workout.exercises.length})</h2>
            {state.workout.exercises.length === 0 && (
              <p className="rounded-xl border bg-card p-6 text-muted-foreground">
                У цьому тренуванні ще немає вправ.
              </p>
            )}
            {state.workout.exercises.map((exercise) => (
              <article key={exercise.id} className="space-y-4 rounded-xl border bg-card p-5">
                <div>
                  <h3 className="font-semibold">{exercise.exerciseNameSnapshot}</h3>
                  {exercise.notes && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {exercise.notes}
                    </p>
                  )}
                </div>
                {exercise.sets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Підходів ще немає.</p>
                ) : (
                  <ol className="space-y-3" aria-label="Підходи">
                    {exercise.sets.map((set) => (
                      <li key={set.id} className="space-y-3 rounded-lg border p-4">
                        <div className="flex flex-wrap justify-between gap-2 text-sm">
                          <span className="font-semibold">
                            Підхід {set.setNumber} · {getWorkoutSetTypeLabel(set.setType)}
                          </span>
                          <span className="text-muted-foreground">
                            {getWorkoutSetStatusLabel(set.status)}
                          </span>
                        </div>
                        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                          <SetMetric
                            label="План · повторення"
                            value={formatWorkoutValue(set.plannedReps)}
                          />
                          <SetMetric
                            label="Факт · повторення"
                            value={formatWorkoutValue(set.actualReps)}
                          />
                          <SetMetric
                            label="План · вага"
                            value={formatWorkoutValue(set.plannedWeightKg, ' кг')}
                          />
                          <SetMetric
                            label="Факт · вага"
                            value={formatWorkoutValue(set.actualWeightKg, ' кг')}
                          />
                          <SetMetric
                            label="План · час"
                            value={formatWorkoutValue(set.plannedDurationSeconds, ' с')}
                          />
                          <SetMetric
                            label="Факт · час"
                            value={formatWorkoutValue(set.actualDurationSeconds, ' с')}
                          />
                          <SetMetric
                            label="План · дистанція"
                            value={formatWorkoutValue(set.plannedDistanceMeters, ' м')}
                          />
                          <SetMetric
                            label="Факт · дистанція"
                            value={formatWorkoutValue(set.actualDistanceMeters, ' м')}
                          />
                        </dl>
                        {set.notes && (
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                            {set.notes}
                          </p>
                        )}
                        {state.workout.status === 'IN_PROGRESS' && (
                          <>
                            {editingSetId === set.id ? (
                              <WorkoutSetForm
                                key={set.updatedAt}
                                workoutId={state.workout.id}
                                set={set}
                                onSaved={retry}
                                onClose={() => setEditingSetId(null)}
                              />
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditingSetId(set.id)}
                              >
                                {set.status === 'PENDING'
                                  ? 'Записати результат'
                                  : 'Змінити результат'}
                              </Button>
                            )}
                          </>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
