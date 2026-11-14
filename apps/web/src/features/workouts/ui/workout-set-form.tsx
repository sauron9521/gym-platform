'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import {
  buildWorkoutSetPayload,
  getWorkoutSetDefaults,
  getWorkoutSetSubmitError,
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
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);
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
  const busy = isSubmitting || skipping;

  async function send(status: 'COMPLETED' | 'SKIPPED', values: WorkoutSetFormValues) {
    setError(null);
    try {
      const { response } = await webApi.PATCH('/workouts/{id}/sets/{setId}', {
        params: { path: { id: workoutId, setId: set.id } },
        body: buildWorkoutSetPayload(status, values),
      });
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (response.status !== 200) {
        setError(getWorkoutSetSubmitError(response.status));
        return;
      }
      onSaved();
    } catch {
      setError(getWorkoutSetSubmitError());
    }
  }

  async function skip() {
    if (busy) return;
    setSkipping(true);
    try {
      await send('SKIPPED', getWorkoutSetDefaults(set));
    } finally {
      setSkipping(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit((values) => send('COMPLETED', values))}
      noValidate
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
                {...register(name, { onChange: () => setError(null) })}
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
          {...register('notes', { onChange: () => setError(null) })}
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
        <Button type="submit" disabled={busy}>
          {isSubmitting ? 'Зберігаємо…' : 'Позначити виконаним'}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void skip()}>
          {skipping ? 'Пропускаємо…' : 'Пропустити підхід'}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          Закрити
        </Button>
      </div>
    </form>
  );
}
