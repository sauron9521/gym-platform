'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import {
  buildWorkoutEditPayload,
  editWorkoutSchema,
  getWorkoutEditDefaults,
  getWorkoutEditErrorMessage,
  type EditWorkoutValues,
} from '../lib/edit-workout';
import type { WorkoutDetailsData } from '../lib/workout-details';

export function EditWorkoutForm({
  workout,
  onSaved,
  onCancel,
  onReload,
}: {
  workout: WorkoutDetailsData;
  onSaved: (workout: WorkoutDetailsData) => void;
  onCancel: () => void;
  onReload: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
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

    setError(null);

    try {
      const { data, response } = await webApi.PATCH('/workouts/{id}', {
        params: { path: { id: workout.id } },
        body,
      });

      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (response.status !== 200 || !data) {
        setError(getWorkoutEditErrorMessage(response.status));
        return;
      }
      onSaved(data);
    } catch {
      setError(getWorkoutEditErrorMessage());
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
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'edit-workout-title-error' : undefined}
            {...register('title', { onChange: () => setError(null) })}
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
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.scheduledAt)}
            aria-describedby={errors.scheduledAt ? 'edit-workout-date-error' : undefined}
            {...register('scheduledAt', { onChange: () => setError(null) })}
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
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.notes)}
            aria-describedby={errors.notes ? 'edit-workout-notes-error' : undefined}
            {...register('notes', { onChange: () => setError(null) })}
            className="w-full rounded-md border border-input bg-background p-3 text-sm"
          />
          {errors.notes && (
            <p id="edit-workout-notes-error" role="alert" className="text-xs text-destructive">
              {errors.notes.message}
            </p>
          )}
        </div>
        {error && (
          <div className="space-y-2" role="alert">
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onReload}>
              Оновити дані
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? 'Зберігаємо…' : 'Зберегти зміни'}
          </Button>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Скасувати редагування
          </Button>
        </div>
      </form>
    </section>
  );
}
