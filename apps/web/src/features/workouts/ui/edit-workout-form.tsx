'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/shared/ui/button';
import {
  buildWorkoutEditPayload,
  editWorkoutSchema,
  getWorkoutEditDefaults,
  type EditWorkoutValues,
} from '../lib/edit-workout';
import type { WorkoutDetailsData } from '../lib/workout-details';
import { useUpdateWorkoutMutation } from '../api/workout-mutations';

export function EditWorkoutForm({
  workout,
  onSaved,
  onCancel,
  onReload,
}: {
  workout: WorkoutDetailsData;
  onSaved: () => void;
  onCancel: () => void;
  onReload: () => void;
}) {
  const mutation = useUpdateWorkoutMutation(workout.id);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<EditWorkoutValues>({
    resolver: zodResolver(editWorkoutSchema),
    defaultValues: getWorkoutEditDefaults(workout),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  async function submit(values: EditWorkoutValues) {
    if (workout.status !== 'PLANNED') return;
    const body = buildWorkoutEditPayload(values, dirtyFields);
    if (Object.keys(body).length === 0) {
      onCancel();
      return;
    }

    mutation.reset();

    try {
      await mutation.mutateAsync(body);
      toast.success('Зміни тренування збережено.');
      onSaved();
    } catch {
      // The mutation retains a safe error; preserve form values for retry.
    }
  }

  return (
    <section
      className="space-y-4 rounded-xl border bg-card p-5"
      aria-label="Редагування тренування"
    >
      <h2 className="text-lg font-semibold">Редагувати тренування</h2>
      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="edit-workout-title" className="block text-sm font-medium">
            Назва
          </label>
          <input
            id="edit-workout-title"
            type="text"
            maxLength={120}
            disabled={isSubmitting || mutation.isPending}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'edit-workout-title-error' : undefined}
            {...register('title', { onChange: () => mutation.reset() })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          {errors.title && (
            <p id="edit-workout-title-error" role="alert" className="text-xs text-destructive">
              {errors.title.message}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor="edit-workout-date" className="block text-sm font-medium">
            Запланована дата і час (необов’язково)
          </label>
          <input
            id="edit-workout-date"
            type="datetime-local"
            disabled={isSubmitting || mutation.isPending}
            aria-invalid={Boolean(errors.scheduledAt)}
            aria-describedby={errors.scheduledAt ? 'edit-workout-date-error' : undefined}
            {...register('scheduledAt', { onChange: () => mutation.reset() })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          {errors.scheduledAt && (
            <p id="edit-workout-date-error" role="alert" className="text-xs text-destructive">
              {errors.scheduledAt.message}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor="edit-workout-notes" className="block text-sm font-medium">
            Нотатки
          </label>
          <textarea
            id="edit-workout-notes"
            rows={3}
            maxLength={5000}
            disabled={isSubmitting || mutation.isPending}
            aria-invalid={Boolean(errors.notes)}
            aria-describedby={errors.notes ? 'edit-workout-notes-error' : undefined}
            {...register('notes', { onChange: () => mutation.reset() })}
            className="w-full rounded-md border border-input bg-background p-3 text-sm"
          />
          {errors.notes && (
            <p id="edit-workout-notes-error" role="alert" className="text-xs text-destructive">
              {errors.notes.message}
            </p>
          )}
        </div>
        {mutation.isError && (
          <div className="space-y-2" role="alert">
            <p className="text-sm text-destructive">{mutation.error.message}</p>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || mutation.isPending}
              onClick={onReload}
            >
              Оновити дані
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isSubmitting || mutation.isPending || !isDirty}>
            {isSubmitting ? 'Зберігаємо…' : 'Зберегти зміни'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting || mutation.isPending}
            onClick={onCancel}
          >
            Скасувати редагування
          </Button>
        </div>
      </form>
    </section>
  );
}
