'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/shared/ui/button';
import { useWorkoutActionMutation } from '../api/workout-mutations';
import type { WorkoutDetailsData } from '../lib/workout-details';
import {
  availableWorkoutActions,
  canCompleteWorkout,
  WORKOUT_ACTION_LABELS,
  type WorkoutAction,
} from '../lib/workout-actions';

export function WorkoutActions({
  workout,
  onReload,
}: {
  workout: WorkoutDetailsData;
  onReload: () => void;
}) {
  const mutation = useWorkoutActionMutation(workout.id);
  const [activeAction, setActiveAction] = useState<WorkoutAction | null>(null);
  const [confirmation, setConfirmation] = useState<WorkoutAction | null>(null);
  const actions = availableWorkoutActions(workout);
  const inProgress = mutation.isPending;
  const hasPendingSets = workout.exercises.some((exercise) =>
    exercise.sets.some((set) => set.status === 'PENDING'),
  );

  async function execute(action: WorkoutAction) {
    if (inProgress || !actions.includes(action)) return;
    setConfirmation(null);
    mutation.reset();
    setActiveAction(action);
    try {
      await mutation.mutateAsync(action);
      toast.success(
        action === 'start'
          ? 'Тренування розпочато.'
          : action === 'complete'
            ? 'Тренування завершено.'
            : 'Тренування скасовано.',
      );
    } catch {
      // The mutation keeps safe status-derived errors for display.
    } finally {
      setActiveAction(null);
    }
  }

  function requestAction(action: WorkoutAction) {
    if (inProgress) return;
    mutation.reset();
    if (action === 'start') {
      void execute(action);
    } else {
      setConfirmation(action);
    }
  }

  if (actions.length === 0) return null;

  return (
    <section
      className="min-w-0 space-y-3 rounded-xl border bg-card p-4 sm:p-5"
      aria-label="Керування тренуванням"
    >
      <h2 className="font-semibold">Керування тренуванням</h2>
      {workout.status === 'IN_PROGRESS' && !canCompleteWorkout(workout) && (
        <p className="text-sm text-muted-foreground">
          {hasPendingSets
            ? 'Щоб завершити тренування, обробіть усі підходи.'
            : 'Щоб завершити тренування, виконайте хоча б один підхід.'}
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        {actions.map((action) => (
          <Button
            key={action}
            type="button"
            variant={action === 'cancel' ? 'outline' : 'default'}
            className="min-h-11 w-full sm:w-auto"
            disabled={inProgress}
            onClick={() => requestAction(action)}
          >
            {inProgress && activeAction === action ? 'Виконується…' : WORKOUT_ACTION_LABELS[action]}
          </Button>
        ))}
      </div>
      {confirmation && (
        <div
          className="min-w-0 space-y-3 rounded-lg border p-3 sm:p-4"
          role="group"
          aria-label="Підтвердження дії"
        >
          <p className="text-sm">
            {confirmation === 'cancel'
              ? 'Скасувати це тренування? Дію не можна буде відновити.'
              : 'Завершити це тренування? Після завершення змінити підходи не можна.'}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:gap-3">
            <Button
              type="button"
              className="min-h-11 w-full sm:w-auto"
              disabled={inProgress}
              onClick={() => void execute(confirmation)}
            >
              Підтвердити
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              disabled={inProgress}
              onClick={() => setConfirmation(null)}
            >
              Назад
            </Button>
          </div>
        </div>
      )}
      {mutation.isError && (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-destructive">{mutation.error.message}</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            disabled={inProgress}
            onClick={() => {
              mutation.reset();
              onReload();
            }}
          >
            Оновити дані
          </Button>
        </div>
      )}
    </section>
  );
}
