'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@/shared/ui/button';
import { useEditProgramWorkoutMutation } from '../api/program-workout-mutations';
import {
  isWeekWithinDuration,
  type ProgramVersionWithWorkouts,
} from '../lib/create-program-workout';
import {
  buildUpdateProgramWorkoutPayload,
  editProgramWorkoutSchema,
  type EditProgramWorkoutValues,
  type ProgramWorkout,
} from '../lib/edit-program-workout';

export function EditProgramWorkoutForm({
  programId,
  versionId,
  workout,
  durationWeeks,
  onSaved,
  onCancel,
}: {
  programId: string;
  versionId: string;
  workout: ProgramWorkout;
  durationWeeks: number | null;
  onSaved: (version: ProgramVersionWithWorkouts) => void;
  onCancel: () => void;
}) {
  const mutation = useEditProgramWorkoutMutation(programId, versionId);
  const form = useForm<EditProgramWorkoutValues>({
    resolver: zodResolver(editProgramWorkoutSchema),
    defaultValues: {
      weekNumber: String(workout.weekNumber),
      dayNumber: String(workout.dayNumber),
      title: workout.title,
      notes: workout.notes ?? '',
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const { errors, isSubmitting } = form.formState;
  const fieldId = (name: string) => `edit-workout-${workout.id}-${name}`;

  async function submit(values: EditProgramWorkoutValues) {
    mutation.reset();
    const payload = buildUpdateProgramWorkoutPayload(values);
    if (!isWeekWithinDuration(Number(values.weekNumber), durationWeeks)) {
      form.setError('weekNumber', {
        type: 'validate',
        message: 'Тиждень перевищує тривалість програми.',
      });
      return;
    }

    try {
      const version = await mutation.mutateAsync({ workoutId: workout.id, body: payload });
      onSaved(version);
    } catch {
      // Preserve values and expose the safe mutation error.
    }
  }

  return (
    <form
      aria-label={`Редагування тренувального дня ${workout.title}`}
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
      noValidate
      className="space-y-4 border-t pt-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={fieldId('week')} className="block text-sm font-medium">
            Тиждень редагування
          </label>
          <input
            id={fieldId('week')}
            type="text"
            inputMode="numeric"
            maxLength={2}
            disabled={isSubmitting || mutation.isPending}
            aria-invalid={Boolean(errors.weekNumber)}
            {...form.register('weekNumber')}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          {errors.weekNumber && (
            <p role="alert" className="text-xs text-destructive">
              {errors.weekNumber.message}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor={fieldId('day')} className="block text-sm font-medium">
            День редагування
          </label>
          <input
            id={fieldId('day')}
            type="text"
            inputMode="numeric"
            maxLength={1}
            disabled={isSubmitting || mutation.isPending}
            aria-invalid={Boolean(errors.dayNumber)}
            {...form.register('dayNumber')}
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
        <label htmlFor={fieldId('title')} className="block text-sm font-medium">
          Нова назва тренування
        </label>
        <input
          id={fieldId('title')}
          type="text"
          maxLength={120}
          disabled={isSubmitting || mutation.isPending}
          aria-invalid={Boolean(errors.title)}
          {...form.register('title')}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
        {errors.title && (
          <p role="alert" className="text-xs text-destructive">
            {errors.title.message}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <label htmlFor={fieldId('notes')} className="block text-sm font-medium">
          Примітки до дня (необов’язково)
        </label>
        <textarea
          id={fieldId('notes')}
          rows={3}
          maxLength={5000}
          disabled={isSubmitting || mutation.isPending}
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
        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          {isSubmitting || mutation.isPending ? 'Зберігаємо…' : 'Зберегти день'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting || mutation.isPending}>
          Скасувати редагування
        </Button>
      </div>
    </form>
  );
}
