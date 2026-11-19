'use client';

import { Button } from '@/shared/ui/button';

import {
  formatWorkoutValue,
  getWorkoutSetStatusLabel,
  getWorkoutSetTypeLabel,
  type WorkoutDetailsData,
} from '../lib/workout-details';
import { SetMetric } from './workout-set-metric';
import { WorkoutSetForm } from './workout-set-form';

type SetData = WorkoutDetailsData['exercises'][number]['sets'][number];

type Props = {
  workoutId: string;
  set: SetData;
  editable: boolean;
  editing: boolean;
  editingLocked: boolean;
  nextPendingSetId?: string | null;
  onEditSet: (id: string | null) => void;
};

const tones: Record<SetData['status'], { card: string; label: string }> = {
  PENDING: { card: 'bg-background', label: 'bg-muted text-muted-foreground' },
  COMPLETED: {
    card: 'border-primary/30 bg-primary/5',
    label: 'bg-primary/10 text-primary',
  },
  SKIPPED: { card: 'bg-muted/40', label: 'bg-muted text-muted-foreground' },
};

export function WorkoutSetCard({
  workoutId,
  set,
  editable,
  editing,
  editingLocked,
  nextPendingSetId,
  onEditSet,
}: Props) {
  const metrics = [
    { label: 'Повторення', plan: set.plannedReps, actual: set.actualReps, unit: '' },
    { label: 'Вага', plan: set.plannedWeightKg, actual: set.actualWeightKg, unit: ' кг' },
    {
      label: 'Тривалість',
      plan: set.plannedDurationSeconds,
      actual: set.actualDurationSeconds,
      unit: ' с',
    },
    {
      label: 'Дистанція',
      plan: set.plannedDistanceMeters,
      actual: set.actualDistanceMeters,
      unit: ' м',
    },
  ].filter(({ plan, actual }) => plan !== null || actual !== null);
  const tone = tones[set.status];

  function closeEditor() {
    onEditSet(null);
    // Restore keyboard focus to the edit control after the form unmounts.
    window.requestAnimationFrame(() => {
      document.getElementById(`workout-set-edit-${set.id}`)?.focus({ preventScroll: true });
    });
  }

  return (
    <li
      id={`workout-set-${set.id}`}
      className={`min-w-0 scroll-mt-24 space-y-3 rounded-xl border p-3 sm:p-4 ${tone.card}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words text-sm font-semibold">
          <span className="mr-2 inline-flex size-7 items-center justify-center rounded-lg bg-muted font-bold tabular-nums">
            {set.setNumber}
          </span>
          <span className="sr-only">Підхід {set.setNumber}, </span>
          {getWorkoutSetTypeLabel(set.setType)}
        </p>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone.label}`}>
          {getWorkoutSetStatusLabel(set.status)}
        </span>
      </div>

      {metrics.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {metrics.map(({ label, plan, actual, unit }) => (
            <div key={label} className="min-w-0 rounded-lg border bg-card/80 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <SetMetric label="План" value={formatWorkoutValue(plan, unit)} />
                <SetMetric label="Факт" value={formatWorkoutValue(actual, unit)} />
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Показники підходу не вказані.</p>
      )}

      {set.notes && (
        <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{set.notes}</p>
      )}

      {editable &&
        (editing ? (
          <WorkoutSetForm
            key={set.updatedAt}
            workoutId={workoutId}
            set={set}
            onSaved={() => onEditSet(null)}
            onSavedAndNext={
              nextPendingSetId
                ? () => {
                    onEditSet(nextPendingSetId);
                    document.getElementById(`workout-set-${nextPendingSetId}`)?.scrollIntoView?.({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }
                : undefined
            }
            onClose={closeEditor}
          />
        ) : (
          <Button
            id={`workout-set-edit-${set.id}`}
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            disabled={editingLocked}
            onClick={() => onEditSet(set.id)}
          >
            {set.status === 'PENDING' ? 'Записати результат' : 'Змінити результат'}
          </Button>
        ))}
    </li>
  );
}
