'use client';

import { useState } from 'react';

import { Button } from '@/shared/ui/button';
import type { ProgramVersionWithWorkouts } from '../lib/create-program-workout';
import type { ProgramWorkout } from '../lib/edit-program-workout';
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
  const [addingSet, setAddingSet] = useState(false);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);

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
          {[...exercise.sets]
            .sort((first, second) => first.setNumber - second.setNumber)
            .map((set) => (
              <ProgramSetItem
                key={set.id}
                programId={programId}
                versionId={versionId}
                workoutId={workoutId}
                exerciseId={exercise.id}
                exerciseName={exercise.exerciseNameSnapshot}
                set={set}
                editable={editable}
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
