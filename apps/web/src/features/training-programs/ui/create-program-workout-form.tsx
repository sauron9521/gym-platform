'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import {
  buildCreateProgramWorkoutPayload,
  createProgramWorkoutSchema,
  getCreateProgramWorkoutError,
  isWeekWithinDuration,
  type CreateProgramWorkoutValues,
  type ProgramVersionWithWorkouts,
} from '../lib/create-program-workout';

export function CreateProgramWorkoutForm({
  programId,
  versionId,
  durationWeeks,
  onCreated,
}: {
  programId: string;
  versionId: string;
  durationWeeks: number | null;
  onCreated: (version: ProgramVersionWithWorkouts) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const form = useForm<CreateProgramWorkoutValues>({
    resolver: zodResolver(createProgramWorkoutSchema),
    defaultValues: { weekNumber: '1', dayNumber: '1', title: '', notes: '' },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const { errors, isSubmitting } = form.formState;

  async function submit(values: CreateProgramWorkoutValues) {
    setError(null);
    setCreated(false);

    const payload = buildCreateProgramWorkoutPayload(values);
    if (!isWeekWithinDuration(payload.weekNumber, durationWeeks)) {
      form.setError('weekNumber', {
        type: 'validate',
        message: 'Тиждень перевищує тривалість програми.',
      });
      return;
    }

    try {
      const { response, data } = await webApi.POST(
        '/training-programs/{programId}/versions/{versionId}/workouts',
        {
          params: { path: { programId, versionId } },
          body: payload,
        },
      );
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (response.status !== 201 || !data) {
        setError(getCreateProgramWorkoutError(response.status));
        return;
      }

      onCreated(data);
      form.reset({ weekNumber: values.weekNumber, dayNumber: '1', title: '', notes: '' });
      setCreated(true);
    } catch {
      setError(getCreateProgramWorkoutError());
    }
  }

  return (
    <form
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
      noValidate
      className="space-y-4 rounded-xl border bg-card p-5"
      aria-label="Додавання тренувального дня"
    >
      <h3 className="text-lg font-semibold">Додати тренувальний день</h3>
      <p className="text-sm text-muted-foreground">
        День визначається парою номерів тижня та дня (1–7). Кожна пара може бути лише одна.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="program-workout-week" className="block text-sm font-medium">
            Тиждень
          </label>
          <input
            id="program-workout-week"
            type="text"
            inputMode="numeric"
            maxLength={2}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.weekNumber)}
            {...form.register('weekNumber', { onChange: () => setCreated(false) })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          {errors.weekNumber && (
            <p role="alert" className="text-xs text-destructive">
              {errors.weekNumber.message}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor="program-workout-day" className="block text-sm font-medium">
            День
          </label>
          <input
            id="program-workout-day"
            type="text"
            inputMode="numeric"
            maxLength={1}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.dayNumber)}
            {...form.register('dayNumber', { onChange: () => setCreated(false) })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          {errors.dayNumber && (
            <p role="alert" className="text-xs text-destructive">
              {errors.dayNumber.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="program-workout-title" className="block text-sm font-medium">
          Назва тренування
        </label>
        <input
          id="program-workout-title"
          type="text"
          maxLength={120}
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.title)}
          {...form.register('title', { onChange: () => setCreated(false) })}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
        {errors.title && (
          <p role="alert" className="text-xs text-destructive">
            {errors.title.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="program-workout-notes" className="block text-sm font-medium">
          Примітки (необов’язково)
        </label>
        <textarea
          id="program-workout-notes"
          rows={3}
          maxLength={5000}
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.notes)}
          {...form.register('notes', { onChange: () => setCreated(false) })}
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
      {created && (
        <p role="status" className="text-sm">
          Тренувальний день додано
        </p>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Додаємо…' : 'Додати день'}
      </Button>
    </form>
  );
}
