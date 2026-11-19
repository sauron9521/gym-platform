'use client';

import type { WorkoutDetailsData } from '../lib/workout-details';
import { WorkoutSetCard } from './workout-set-card';

type Props = {
  workout: WorkoutDetailsData;
  editingSetId: string | null;
  onEditSet: (setId: string | null) => void;
};

export function WorkoutExercises({ workout, editingSetId, onEditSet }: Props) {
  return (
    <section className="min-w-0 space-y-4" aria-label="Вправи тренування">
      <h2 className="text-xl font-semibold tracking-tight">Вправи ({workout.exercises.length})</h2>

      {workout.exercises.length === 0 && (
        <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          У цьому тренуванні ще немає вправ.
        </p>
      )}

      {workout.exercises.map((exercise) => {
        const completed = exercise.sets.filter((set) => set.status === 'COMPLETED').length;
        const titleId = `workout-exercise-${exercise.id}`;

        return (
          <article
            key={exercise.id}
            aria-labelledby={titleId}
            className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-6"
          >
            <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <h3 id={titleId} className="break-words text-base font-semibold sm:text-lg">
                  {exercise.exerciseNameSnapshot}
                </h3>
                {exercise.notes && (
                  <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {exercise.notes}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                Виконано {completed} із {exercise.sets.length}
              </span>
            </header>

            {exercise.sets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Підходів ще немає.</p>
            ) : (
              <ol className="space-y-2" aria-label={`Підходи: ${exercise.exerciseNameSnapshot}`}>
                {exercise.sets.map((set) => (
                  <WorkoutSetCard
                    key={set.id}
                    workoutId={workout.id}
                    set={set}
                    editable={workout.status === 'IN_PROGRESS'}
                    editing={editingSetId === set.id}
                    editingLocked={editingSetId !== null}
                    onEditSet={onEditSet}
                  />
                ))}
              </ol>
            )}
          </article>
        );
      })}
    </section>
  );
}
