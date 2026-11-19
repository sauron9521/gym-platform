'use client';

import { useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/shared/ui/button';
import { useUpdateWorkoutSetMutation } from '../api/workout-set-mutation';
import {
  buildWorkoutSetPayload,
  getWorkoutSetDefaults,
  workoutSetFormSchema,
  type WorkoutSetData,
  type WorkoutSetFormValues,
} from '../lib/workout-set-form';

const fields: ReadonlyArray<{
  name: Exclude<keyof WorkoutSetFormValues, 'notes'>;
  label: string;
}> = [
  { name: 'actualReps', label: 'Повторення' },
  { name: 'actualWeightKg', label: 'Вага (кг)' },
  { name: 'actualDurationSeconds', label: 'Тривалість (с)' },
  { name: 'actualDistanceMeters', label: 'Дистанція (м)' },
  { name: 'restSeconds', label: 'Відпочинок (с)' },
  { name: 'rpe', label: 'RPE' },
  { name: 'rir', label: 'RIR' },
];

export function WorkoutSetForm({
  workoutId,
  set,
  onSaved,
  onClose,
}: {
  workoutId: string;
  set: WorkoutSetData;
  onSaved: () => void;
  onClose: () => void;
}) {
  const mutation = useUpdateWorkoutSetMutation(workoutId);
  // A synchronous lock covers rapid taps before React paints isPending/disabled.
  const requestInFlight = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WorkoutSetFormValues>({
    resolver: zodResolver(workoutSetFormSchema),
    defaultValues: getWorkoutSetDefaults(set),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const busy = isSubmitting || mutation.isPending;

  async function send(status: 'COMPLETED' | 'SKIPPED', values: WorkoutSetFormValues) {
    if (requestInFlight.current || mutation.isPending) return;
    requestInFlight.current = true;
    mutation.reset();
    try {
      await mutation.mutateAsync({
        setId: set.id,
        body: buildWorkoutSetPayload(status, values),
      });
      toast.success(
        status === 'COMPLETED'
          ? 'Результат підходу збережено.'
          : 'Підхід позначено пропущеним.',
      );
      onSaved();
    } catch {
      // Mutation holds the status-specific error without dropping form values.
    } finally {
      requestInFlight.current = false;
    }
  }

  function skip() {
    if (busy || requestInFlight.current) return;
    void send('SKIPPED', getWorkoutSetDefaults(set));
  }

  return (
    <form
      onSubmit={handleSubmit((values) => send('COMPLETED', values))}
      noValidate
      aria-busy={busy}
      className="space-y-4 rounded-lg border bg-muted/30 p-4"
      aria-label="Запис результатів підходу"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(({ name, label }) => {
          const errorId = `workout-set-${set.id}-${name}-error`;
          const fieldId = `workout-set-${set.id}-${name}`;
          return (
            <div key={name} className="space-y-1">
              <label htmlFor={fieldId} className="block text-sm font-medium">
                {label}
              </label>
              <input
                id={fieldId}
                type="text"
                inputMode="decimal"
                disabled={busy}
                aria-invalid={Boolean(errors[name])}
                aria-describedby={errors[name] ? errorId : undefined}
                {...register(name, { onChange: () => mutation.reset() })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
              {errors[name] && (
                <p id={errorId} role="alert" className="text-xs text-destructive">
                  {errors[name].message}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="space-y-1">
        <label htmlFor={`workout-set-${set.id}-notes`} className="block text-sm font-medium">
          Нотатки
        </label>
        <textarea
          id={`workout-set-${set.id}-notes`}
          rows={2}
          disabled={busy}
          aria-invalid={Boolean(errors.notes)}
          {...register('notes', { onChange: () => mutation.reset() })}
          className="w-full rounded-md border border-input bg-background p-3 text-sm"
        />
        {errors.notes && (
          <p role="alert" className="text-xs text-destructive">
            {errors.notes.message}
          </p>
        )}
      </div>
      {busy && (
        <p role="status" aria-live="polite" className="text-sm font-medium text-primary">
          {mutation.isPending
            ? mutation.variables?.body.status === 'SKIPPED'
              ? 'Зберігаємо пропуск підходу…'
              : 'Зберігаємо результат підходу…'
            : 'Перевіряємо дані підходу…'}
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {isSubmitting || (mutation.isPending && mutation.variables?.body.status === 'COMPLETED')
            ? 'Зберігаємо…'
            : 'Позначити виконаним'}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void skip()}>
          {mutation.isPending && mutation.variables?.body.status === 'SKIPPED'
            ? 'Пропускаємо…'
            : 'Пропустити підхід'}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          Закрити
        </Button>
      </div>
    </form>
  );
}
