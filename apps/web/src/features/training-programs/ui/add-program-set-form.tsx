'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import type { ProgramVersionWithWorkouts } from '../lib/create-program-workout';
import {
  addProgramSetSchema,
  buildAddProgramSetPayload,
  defaultProgramSetValues,
  getAddProgramSetError,
  programSetTypeLabels,
  programSetTypes,
  type AddProgramSetValues,
  type SavedProgramSet,
} from '../lib/add-program-set';
import {
  buildUpdateProgramSetPayload,
  defaultEditProgramSetValues,
  getProgramSetMutationError,
} from '../lib/edit-program-set';

const targetFields = [
  { name: 'plannedReps', label: 'Повторення', mode: 'numeric' },
  { name: 'plannedWeightKg', label: 'Вага (кг)', mode: 'decimal' },
  { name: 'plannedDurationSeconds', label: 'Тривалість (с)', mode: 'numeric' },
  { name: 'plannedDistanceMeters', label: 'Дистанція (м)', mode: 'decimal' },
  { name: 'restSeconds', label: 'Відпочинок (с)', mode: 'numeric' },
  { name: 'targetRpe', label: 'Цільовий RPE', mode: 'decimal' },
  { name: 'targetRir', label: 'Цільовий RIR', mode: 'numeric' },
] as const;

export function AddProgramSetForm({
  programId,
  versionId,
  workoutId,
  exerciseId,
  exerciseName,
  set,
  onAdded,
  onCancel,
}: {
  programId: string;
  versionId: string;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  set?: SavedProgramSet;
  onAdded: (version: ProgramVersionWithWorkouts) => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<AddProgramSetValues>({
    resolver: zodResolver(addProgramSetSchema),
    defaultValues: set ? defaultEditProgramSetValues(set) : defaultProgramSetValues,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const { errors, isSubmitting } = form.formState;
  const fieldId = (field: string) => `program-set-${exerciseId}-${field}`;

  async function submit(values: AddProgramSetValues) {
    setError(null);
    try {
      const { response, data } = set
        ? await webApi.PATCH(
            '/training-programs/{programId}/versions/{versionId}/workouts/{workoutId}/exercises/{exerciseId}/sets/{setId}',
            {
              params: { path: { programId, versionId, workoutId, exerciseId, setId: set.id } },
              body: buildUpdateProgramSetPayload(values),
            },
          )
        : await webApi.POST(
            '/training-programs/{programId}/versions/{versionId}/workouts/{workoutId}/exercises/{exerciseId}/sets',
            {
              params: { path: { programId, versionId, workoutId, exerciseId } },
              body: buildAddProgramSetPayload(values),
            },
          );
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (response.status !== (set ? 200 : 201) || !data) {
        setError(set ? getProgramSetMutationError('edit', response.status) : getAddProgramSetError(response.status));
        return;
      }
      onAdded(data);
    } catch {
      setError(set ? getProgramSetMutationError('edit') : getAddProgramSetError());
    }
  }

  return (
    <form
      aria-label={set ? `Редагування підходу ${set.setNumber} вправи ${exerciseName}` : `Додавання підходу до вправи ${exerciseName}`}
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
      noValidate
      className="space-y-4 rounded-lg border p-4"
    >
      <h5 className="font-semibold">{set ? `Редагувати підхід ${set.setNumber}` : 'Додати підхід'}</h5>
      <p className="text-xs text-muted-foreground">
        {set ? 'Порожні поля очищають відповідні цілі.' : 'Номер підходу визначає сервер. Заповни потрібні цільові параметри.'}
      </p>
      <div className="space-y-1">
        <label htmlFor={fieldId('type')} className="block text-sm font-medium">
          Тип підходу
        </label>
        <select
          id={fieldId('type')}
          disabled={isSubmitting}
          {...form.register('setType')}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {programSetTypes.map((type) => (
            <option key={type} value={type}>
              {programSetTypeLabels[type]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {targetFields.map((field) => {
          const message = errors[field.name]?.message;
          return (
            <div key={field.name} className="space-y-1">
              <label htmlFor={fieldId(field.name)} className="block text-sm font-medium">
                {field.label}
              </label>
              <input
                id={fieldId(field.name)}
                type="text"
                inputMode={field.mode}
                disabled={isSubmitting}
                aria-invalid={Boolean(message)}
                {...form.register(field.name)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
              {message && (
                <p role="alert" className="text-xs text-destructive">
                  {message}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="space-y-1">
        <label htmlFor={fieldId('notes')} className="block text-sm font-medium">
          Примітки до підходу (необов’язково)
        </label>
        <textarea
          id={fieldId('notes')}
          rows={2}
          maxLength={5000}
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.notes)}
          {...form.register('notes')}
          className="w-full rounded-md border border-input bg-background p-3 text-sm"
        />
        {errors.notes && (
          <p role="alert" className="text-xs text-destructive">
            {errors.notes.message}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Зберігаємо…' : set ? 'Зберегти зміни' : 'Зберегти підхід'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {set ? 'Скасувати редагування підходу' : 'Скасувати додавання підходу'}
        </Button>
      </div>
    </form>
  );
}
