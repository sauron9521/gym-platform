'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import type { ProgramVersionWithWorkouts } from '../lib/create-program-workout';
import { getProgramWorkoutMutationError, type ProgramWorkout } from '../lib/edit-program-workout';
import { EditProgramWorkoutForm } from './edit-program-workout-form';
import { AddProgramExerciseForm } from './add-program-exercise-form';

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
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteWorkout() {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const { response, data } = await webApi.DELETE(
        '/training-programs/{programId}/versions/{versionId}/workouts/{workoutId}',
        { params: { path: { programId, versionId, workoutId: workout.id } } },
      );
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (response.status !== 200 || !data) {
        setError(getProgramWorkoutMutationError('delete', response.status));
        return;
      }
      onChanged(data, 'Тренувальний день видалено');
    } catch {
      setError(getProgramWorkoutMutationError('delete'));
    } finally {
      setDeleting(false);
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
            <li key={exercise.id} className="rounded-md border p-3">
              <p className="text-sm font-medium">{exercise.exerciseNameSnapshot}</p>
              <p className="text-xs text-muted-foreground">
                Тип: {exercise.exerciseTypeSnapshot} · Підходів: {exercise.sets.length}
              </p>
              {exercise.notes && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {exercise.notes}
                </p>
              )}
            </li>
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
                  setError(null);
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
                  setError(null);
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
                  setError(null);
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
                <Button type="button" disabled={deleting} onClick={() => void deleteWorkout()}>
                  {deleting ? 'Видаляємо…' : 'Підтвердити видалення'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleting}
                  onClick={() => {
                    setConfirmDelete(false);
                    setError(null);
                  }}
                >
                  Скасувати видалення
                </Button>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </>
      )}
    </li>
  );
}
