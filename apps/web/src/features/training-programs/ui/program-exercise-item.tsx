'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/shared/ui/button';
import { webApi } from '@/shared/api/client';
import type { ProgramVersionWithWorkouts } from '../lib/create-program-workout';
import type { ProgramWorkout } from '../lib/edit-program-workout';
import {
  buildReorderProgramSetsPayload,
  getReorderProgramSetsError,
  sortProgramSets,
  type SetMoveDirection,
} from '../lib/reorder-program-sets';
import { AddProgramSetForm } from './add-program-set-form';
import { ProgramSetItem } from './program-set-item';

type ProgramExercise = ProgramWorkout['exercises'][number];

export function ProgramExerciseItem({
  programId,
  versionId,
  workoutId,
  exercise,
  editable,
  onChanged,
}: {
  programId: string;
  versionId: string;
  workoutId: string;
  exercise: ProgramExercise;
  editable: boolean;
  onChanged: (version: ProgramVersionWithWorkouts, notice: string) => void;
}) {
  const router = useRouter();
  const [addingSet, setAddingSet] = useState(false);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const sortedSets = sortProgramSets(exercise.sets);

  async function moveSet(setId: string, direction: SetMoveDirection) {
    if (!editable || reordering || addingSet || editingSetId !== null) return;

    const payload = buildReorderProgramSetsPayload(exercise.sets, setId, direction);
    if (!payload) return;

    setReordering(true);
    setReorderError(null);
    try {
      const { response, data } = await webApi.PATCH(
        '/training-programs/{programId}/versions/{versionId}/workouts/{workoutId}/exercises/{exerciseId}/sets/reorder',
        {
          params: { path: { programId, versionId, workoutId, exerciseId: exercise.id } },
          body: payload,
        },
      );
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (response.status !== 200 || !data) {
        setReorderError(getReorderProgramSetsError(response.status));
        return;
      }
      onChanged(data, 'Порядок підходів оновлено');
    } catch {
      setReorderError(getReorderProgramSetsError());
    } finally {
      setReordering(false);
    }
  }

  return (
    <li className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">{exercise.exerciseNameSnapshot}</p>
      <p className="text-xs text-muted-foreground">
        Тип: {exercise.exerciseTypeSnapshot} · Підходів: {exercise.sets.length}
      </p>
      {exercise.notes && (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{exercise.notes}</p>
      )}
      {exercise.sets.length > 0 ? (
        <ol aria-label={`Підходи вправи ${exercise.exerciseNameSnapshot}`} className="space-y-2">
          {sortedSets.map((set, index) => (
              <ProgramSetItem
                key={set.id}
                programId={programId}
                versionId={versionId}
                workoutId={workoutId}
                exerciseId={exercise.id}
                exerciseName={exercise.exerciseNameSnapshot}
                set={set}
                editable={editable}
                moveDisabled={reordering || addingSet || editingSetId !== null}
                canMoveUp={index > 0}
                canMoveDown={index < sortedSets.length - 1}
                onMoveUp={() => void moveSet(set.id, 'up')}
                onMoveDown={() => void moveSet(set.id, 'down')}
                editing={editingSetId === set.id}
                onEdit={() => {
                  setAddingSet(false);
                  setEditingSetId(set.id);
                }}
                onCancelEdit={() => setEditingSetId(null)}
                onChanged={onChanged}
              />
            ))}
        </ol>
      ) : (
        <p className="text-xs text-muted-foreground">Підходів поки немає.</p>
      )}
      {reorderError && (
        <p role="alert" className="text-sm text-destructive">
          {reorderError}
        </p>
      )}
      {editable &&
        (addingSet ? (
          <AddProgramSetForm
            programId={programId}
            versionId={versionId}
            workoutId={workoutId}
            exerciseId={exercise.id}
            exerciseName={exercise.exerciseNameSnapshot}
            onAdded={(version) => {
              setAddingSet(false);
              onChanged(version, 'Підхід додано до вправи');
            }}
            onCancel={() => setAddingSet(false)}
          />
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`Додати підхід до вправи ${exercise.exerciseNameSnapshot}`}
            disabled={reordering}
            onClick={() => {
              setEditingSetId(null);
              setAddingSet(true);
            }}
          >
            Додати підхід
          </Button>
        ))}
    </li>
  );
}
