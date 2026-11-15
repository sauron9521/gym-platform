'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { describeProgramSet, type SavedProgramSet } from '../lib/add-program-set';
import type { ProgramVersionWithWorkouts } from '../lib/create-program-workout';
import { getProgramSetMutationError } from '../lib/edit-program-set';
import { AddProgramSetForm } from './add-program-set-form';

export function ProgramSetItem({
  programId,
  versionId,
  workoutId,
  exerciseId,
  exerciseName,
  set,
  editable,
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
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onChanged: (version: ProgramVersionWithWorkouts, notice: string) => void;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteSet() {
    if (!confirmDelete || deleting || !editable) return;
    setDeleting(true);
    setError(null);
    try {
      const { response, data } = await webApi.DELETE(
        '/training-programs/{programId}/versions/{versionId}/workouts/{workoutId}/exercises/{exerciseId}/sets/{setId}',
        {
          params: { path: { programId, versionId, workoutId, exerciseId, setId: set.id } },
        },
      );
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (response.status !== 200 || !data) {
        setError(getProgramSetMutationError('delete', response.status));
        return;
      }
      onChanged(data, 'Підхід видалено');
    } catch {
      setError(getProgramSetMutationError('delete'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="space-y-3 rounded-md bg-muted p-3 text-sm">
      <p>Підхід {set.setNumber}: {describeProgramSet(set)}</p>
      {set.notes && <p className="whitespace-pre-wrap text-muted-foreground">{set.notes}</p>}
      {editable && (
        <>
          {!editing && !confirmDelete && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Редагувати підхід ${set.setNumber} вправи ${exerciseName}`}
                onClick={() => {
                  setError(null);
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
                onClick={() => {
                  setError(null);
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
                <Button type="button" disabled={deleting} onClick={() => void deleteSet()}>
                  {deleting ? 'Видаляємо…' : 'Підтвердити видалення підходу'}
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
                  Скасувати видалення підходу
                </Button>
              </div>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </>
      )}
    </li>
  );
}
