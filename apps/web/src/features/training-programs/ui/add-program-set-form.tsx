'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@/shared/ui/button';
import {
  useCreateProgramSetMutation,
  useUpdateProgramSetMutation,
} from '../api/program-set-mutations';
import type { ProgramVersionWithWorkouts } from '../lib/create-program-workout';
import {
  addProgramSetSchema,
  buildAddProgramSetPayload,
  defaultProgramSetValues,
  programSetTypeLabels,
  programSetTypes,
  type AddProgramSetValues,
  type SavedProgramSet,
} from '../lib/add-program-set';
import {
  buildUpdateProgramSetPayload,
  defaultEditProgramSetValues,
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
  const path = { programId, versionId, workoutId, exerciseId };
  const createMutation = useCreateProgramSetMutation(path);
  const updateMutation = useUpdateProgramSetMutation(path);
  const mutation = set ? updateMutation : createMutation;
  const form = useForm<AddProgramSetValues>({
    resolver: zodResolver(addProgramSetSchema),
    defaultValues: set ? defaultEditProgramSetValues(set) : defaultProgramSetValues,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const { errors, isSubmitting } = form.formState;
  const busy = isSubmitting || mutation.isPending;
  const fieldId = (field: string) => `program-set-${exerciseId}-${field}`;

  async function submit(values: AddProgramSetValues) {
    mutation.reset();
    try {
      const version = set
        ? await updateMutation.mutateAsync({
            setId: set.id,
            body: buildUpdateProgramSetPayload(values),
          })
        : await createMutation.mutateAsync(buildAddProgramSetPayload(values));
      onAdded(version);
    } catch {
      // Keep the current form values and status-specific mutation error for retry.
    }
  }

  return (
    <form
      aria-label={
        set
          ? `Редагування підходу ${set.setNumber} вправи ${exerciseName}`
          : `Додавання підходу до вправи ${exerciseName}`
      }
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
      noValidate
      className="space-y-4 rounded-lg border p-4"
    >
      <h5 className="font-semibold">
        {set ? `Редагувати підхід ${set.setNumber}` : 'Додати підхід'}
      </h5>
      <p className="text-xs text-muted-foreground">
        {set
          ? 'Порожні поля очищають відповідні цілі.'
          : 'Номер підходу визначає сервер. Заповни потрібні цільові параметри.'}
      </p>
      <div className="space-y-1">
        <label htmlFor={fieldId('type')} className="block text-sm font-medium">
          Тип підходу
        </label>
        <select
          id={fieldId('type')}
          disabled={busy}
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
                disabled={busy}
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
          disabled={busy}
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
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Зберігаємо…' : set ? 'Зберегти зміни' : 'Зберегти підхід'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          {set ? 'Скасувати редагування підходу' : 'Скасувати додавання підходу'}
        </Button>
      </div>
    </form>
  );
}
