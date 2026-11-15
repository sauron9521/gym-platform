'use client';

import { useState } from 'react';

import { Button } from '@/shared/ui/button';
import { useDeleteProgramSetMutation } from '../api/program-set-mutations';
import { describeProgramSet, type SavedProgramSet } from '../lib/add-program-set';
import type { ProgramVersionWithWorkouts } from '../lib/create-program-workout';
import { AddProgramSetForm } from './add-program-set-form';

export function ProgramSetItem({
  programId,
  versionId,
  workoutId,
  exerciseId,
  exerciseName,
  set,
  editable,
  moveDisabled,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  editing,
  onEdit,
  onCancelEdit,
  onChanged,
}: {
  programId: string;
  versionId: string;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  set: SavedProgramSet;
  editable: boolean;
  moveDisabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onChanged: (version: ProgramVersionWithWorkouts, notice: string) => void;
}) {
  const deleteMutation = useDeleteProgramSetMutation({
    programId,
    versionId,
    workoutId,
    exerciseId,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function deleteSet() {
    if (!confirmDelete || deleteMutation.isPending || !editable) return;
    deleteMutation.reset();
    try {
      const version = await deleteMutation.mutateAsync(set.id);
      onChanged(version, 'Підхід видалено');
    } catch {
      // Keep confirmation open and display the safe mutation error.
    }
  }

  return (
    <li className="space-y-3 rounded-md bg-muted p-3 text-sm">
      <p>
        Підхід {set.setNumber}: {describeProgramSet(set)}
      </p>
      {set.notes && <p className="whitespace-pre-wrap text-muted-foreground">{set.notes}</p>}
      {editable && (
        <>
          {!editing && !confirmDelete && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Перемістити підхід ${set.setNumber} вгору у вправі ${exerciseName}`}
                disabled={moveDisabled || !canMoveUp}
                onClick={onMoveUp}
              >
                Вгору
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Перемістити підхід ${set.setNumber} вниз у вправі ${exerciseName}`}
                disabled={moveDisabled || !canMoveDown}
                onClick={onMoveDown}
              >
                Вниз
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={moveDisabled}
                aria-label={`Редагувати підхід ${set.setNumber} вправи ${exerciseName}`}
                onClick={() => {
                  deleteMutation.reset();
                  onEdit();
                }}
              >
                Редагувати
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Видалити підхід ${set.setNumber} вправи ${exerciseName}`}
                disabled={moveDisabled}
                onClick={() => {
                  deleteMutation.reset();
                  setConfirmDelete(true);
                }}
              >
                Видалити
              </Button>
            </div>
          )}
          {editing && (
            <AddProgramSetForm
              programId={programId}
              versionId={versionId}
              workoutId={workoutId}
              exerciseId={exerciseId}
              exerciseName={exerciseName}
              set={set}
              onAdded={(version) => {
                onCancelEdit();
                onChanged(version, 'Підхід оновлено');
              }}
              onCancel={onCancelEdit}
            />
          )}
          {confirmDelete && (
            <div
              role="group"
              aria-label={`Підтвердження видалення підходу ${set.setNumber} вправи ${exerciseName}`}
              className="space-y-3 rounded-md border p-3"
            >
              <p>Видалити підхід {set.setNumber}? Дію не можна скасувати.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={deleteMutation.isPending} onClick={() => void deleteSet()}>
                  {deleteMutation.isPending ? 'Видаляємо…' : 'Підтвердити видалення підходу'}
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
                  Скасувати видалення підходу
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
