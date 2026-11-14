'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import type { WorkoutDetailsData } from '../lib/workout-details';
import {
  availableWorkoutActions,
  canCompleteWorkout,
  getWorkoutActionErrorMessage,
  WORKOUT_ACTION_LABELS,
  type WorkoutAction,
} from '../lib/workout-actions';

type ActionState = { kind: 'idle' } | { kind: 'busy'; action: WorkoutAction };

export function WorkoutActions({
  workout,
  onUpdated,
  onReload,
}: {
  workout: WorkoutDetailsData;
  onUpdated: (workout: WorkoutDetailsData) => void;
  onReload: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ kind: 'idle' });
  const [confirmation, setConfirmation] = useState<WorkoutAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actions = availableWorkoutActions(workout);
  const inProgress = state.kind === 'busy';
  const hasPendingSets = workout.exercises.some((exercise) =>
    exercise.sets.some((set) => set.status === 'PENDING'),
  );

  async function execute(action: WorkoutAction) {
    if (inProgress || !actions.includes(action)) return;
    setConfirmation(null);
    setError(null);
    setState({ kind: 'busy', action });

    try {
      const params = { path: { id: workout.id } };
      const result =
        action === 'start'
          ? await webApi.POST('/workouts/{id}/start', { params })
          : action === 'complete'
            ? await webApi.POST('/workouts/{id}/complete', { params })
            : await webApi.POST('/workouts/{id}/cancel', { params });

      if (result.response.status === 401) {
        router.replace('/login');
        return;
      }
      if (result.response.status !== 200 || !result.data) {
        setError(getWorkoutActionErrorMessage(result.response.status));
        return;
      }
      onUpdated(result.data);
    } catch {
      setError(getWorkoutActionErrorMessage());
    } finally {
      setState({ kind: 'idle' });
    }
  }

  function requestAction(action: WorkoutAction) {
    if (inProgress) return;
    setError(null);
    if (action === 'start') {
      void execute(action);
    } else {
      setConfirmation(action);
    }
  }

  if (actions.length === 0) return null;

  return (
    <section className="space-y-3 rounded-xl border bg-card p-5" aria-label="Керування тренуванням">
      <h2 className="font-semibold">Керування тренуванням</h2>
      {workout.status === 'IN_PROGRESS' && !canCompleteWorkout(workout) && (
        <p className="text-sm text-muted-foreground">
          {hasPendingSets
            ? 'Щоб завершити тренування, обробіть усі підходи.'
            : 'Щоб завершити тренування, виконайте хоча б один підхід.'}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => (
          <Button
            key={action}
            type="button"
            variant={action === 'cancel' ? 'outline' : 'default'}
            disabled={inProgress}
            onClick={() => requestAction(action)}
          >
            {inProgress && state.action === action ? 'Виконується…' : WORKOUT_ACTION_LABELS[action]}
          </Button>
        ))}
      </div>
      {confirmation && (
        <div className="space-y-3 rounded-lg border p-4" role="group" aria-label="Підтвердження дії">
          <p className="text-sm">
            {confirmation === 'cancel'
              ? 'Скасувати це тренування? Дію не можна буде відновити.'
              : 'Завершити це тренування? Після завершення змінити підходи не можна.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={inProgress} onClick={() => void execute(confirmation)}>
              Підтвердити
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={inProgress}
              onClick={() => setConfirmation(null)}
            >
              Назад
            </Button>
          </div>
        </div>
      )}
      {error && (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" variant="outline" disabled={inProgress} onClick={onReload}>
            Оновити дані
          </Button>
        </div>
      )}
    </section>
  );
}
