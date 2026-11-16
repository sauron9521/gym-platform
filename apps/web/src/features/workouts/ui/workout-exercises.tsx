'use client';

import { Button } from '@/shared/ui/button';

import {
  formatWorkoutValue,
  getWorkoutSetStatusLabel,
  getWorkoutSetTypeLabel,
  type WorkoutDetailsData,
} from '../lib/workout-details';
import { WorkoutSetForm } from './workout-set-form';
import { SetMetric } from './workout-set-metric';

type Props = {
  workout: WorkoutDetailsData;
  editingSetId: string | null;
  onEditSet: (setId: string | null) => void;
};

// Preserve the original nested set editor layout while extracting it intact.
// prettier-ignore
export function WorkoutExercises({ workout, editingSetId, onEditSet }: Props) {
  return (
    <section className="space-y-4" aria-label="Вправи тренування">
      <h2 className="text-xl font-semibold">Вправи ({workout.exercises.length})</h2>
      {workout.exercises.length === 0 && (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">
          У цьому тренуванні ще немає вправ.
        </p>
      )}
      {workout.exercises.map((exercise) => (
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
                  {workout.status === 'IN_PROGRESS' && (
                    <>
                      {editingSetId === set.id ? (
                        <WorkoutSetForm
                          key={set.updatedAt}
                          workoutId={workout.id}
                          set={set}
                          onSaved={() => onEditSet(null)}
                          onClose={() => onEditSet(null)}
                        />
                      ) : (
                        <Button type="button" variant="outline" onClick={() => onEditSet(set.id)}>
                          {set.status === 'PENDING' ? 'Записати результат' : 'Змінити результат'}
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
  );
}
