'use client';

import { useState } from 'react';

import { Button } from '@/shared/ui/button';
import { useDeleteProgramWorkoutMutation } from '../api/program-workout-mutations';
import type { ProgramVersionWithWorkouts } from '../lib/create-program-workout';
import type { ProgramWorkout } from '../lib/edit-program-workout';
import { EditProgramWorkoutForm } from './edit-program-workout-form';
import { AddProgramExerciseForm } from './add-program-exercise-form';
import { ProgramExerciseItem } from './program-exercise-item';

export function ProgramWorkoutItem({
  programId,
  versionId,
  workout,
  durationWeeks,
  editable,
  onChanged,
}: {
  programId: string;
  versionId: string;
  workout: ProgramWorkout;
  durationWeeks: number | null;
  editable: boolean;
  onChanged: (version: ProgramVersionWithWorkouts, notice: string) => void;
}) {
  const deleteMutation = useDeleteProgramWorkoutMutation(programId, versionId);
  const [editing, setEditing] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function deleteWorkout() {
    if (!confirmDelete || deleteMutation.isPending) return;
    deleteMutation.reset();
    try {
      const version = await deleteMutation.mutateAsync(workout.id);
      onChanged(version, 'Тренувальний день видалено');
    } catch {
      // Preserve the confirmation so the trainer may retry after an error.
    }
  }

  return (
    <li className="space-y-3 rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">
        Тиждень {workout.weekNumber} · День {workout.dayNumber}
      </p>
      <h3 className="text-lg font-semibold">{workout.title}</h3>
      {workout.notes && (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{workout.notes}</p>
      )}
      <p className="text-sm text-muted-foreground">Вправ: {workout.exercises.length}</p>
      {workout.exercises.length > 0 && (
        <ul aria-label={`Вправи дня ${workout.title}`} className="space-y-2">
          {workout.exercises.map((exercise) => (
            <ProgramExerciseItem
              key={exercise.id}
              programId={programId}
              versionId={versionId}
              workoutId={workout.id}
              exercise={exercise}
              editable={editable}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}

      {editable && (
        <>
          {!editing && !confirmDelete && !addingExercise && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                aria-label={`Додати вправу до дня ${workout.title}`}
                onClick={() => {
                  deleteMutation.reset();
                  setAddingExercise(true);
                }}
              >
                Додати вправу
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-label={`Редагувати день ${workout.title}`}
                onClick={() => {
                  deleteMutation.reset();
                  setAddingExercise(false);
                  setEditing(true);
                }}
              >
                Редагувати
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-label={`Видалити день ${workout.title}`}
                onClick={() => {
                  deleteMutation.reset();
                  setAddingExercise(false);
                  setConfirmDelete(true);
                }}
              >
                Видалити
              </Button>
            </div>
          )}
          {addingExercise && (
            <AddProgramExerciseForm
              programId={programId}
              versionId={versionId}
              workoutId={workout.id}
              workoutTitle={workout.title}
              existingExerciseIds={workout.exercises.map((exercise) => exercise.exerciseId)}
              onAdded={(version) => {
                setAddingExercise(false);
                onChanged(version, 'Вправу додано до тренувального дня');
              }}
              onCancel={() => setAddingExercise(false)}
            />
          )}
          {editing && (
            <EditProgramWorkoutForm
              programId={programId}
              versionId={versionId}
              workout={workout}
              durationWeeks={durationWeeks}
              onSaved={(version) => {
                setEditing(false);
                onChanged(version, 'Тренувальний день оновлено');
              }}
              onCancel={() => setEditing(false)}
            />
          )}
          {confirmDelete && (
            <div
              role="group"
              aria-label={`Підтвердження видалення ${workout.title}`}
              className="space-y-3 rounded-md border p-3"
            >
              <p className="text-sm">Видалити «{workout.title}»? Дію не можна скасувати.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={deleteMutation.isPending} onClick={() => void deleteWorkout()}>
                  {deleteMutation.isPending ? 'Видаляємо…' : 'Підтвердити видалення'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    setConfirmDelete(false);
                    deleteMutation.reset();
                  }}
                >
                  Скасувати видалення
                </Button>
              </div>
            </div>
          )}
          {deleteMutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteMutation.error.message}
            </p>
          )}
        </>
      )}
    </li>
  );
}
