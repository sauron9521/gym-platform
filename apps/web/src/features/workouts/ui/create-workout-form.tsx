'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import {
  buildCreateWorkoutPayload,
  createWorkoutExercise,
  createWorkoutFormSchema,
  getCreateWorkoutErrorMessage,
  type CreateWorkoutValues,
} from '../lib/create-workout';
import { WorkoutExerciseEditor } from './workout-exercise-editor';
import { WorkoutExercisePicker } from './workout-exercise-picker';

export function CreateWorkoutForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const submitting = useRef(false);
  const requestKey = useRef<{ body: string; key: string } | null>(null);
  const form = useForm<CreateWorkoutValues>({
    resolver: zodResolver(createWorkoutFormSchema),
    defaultValues: { title: '', notes: '', scheduledAt: '', exercises: [] },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'exercises',
  });
  const selectedExercises = form.watch('exercises');
  const busy = form.formState.isSubmitting || created;

  async function submit(values: CreateWorkoutValues) {
    if (submitting.current || created) return;
    submitting.current = true;
    setError(null);
    try {
      const body = buildCreateWorkoutPayload(values);
      const serialized = JSON.stringify(body);
      if (requestKey.current?.body !== serialized) {
        requestKey.current = { body: serialized, key: crypto.randomUUID() };
      }
      const { data, response } = await webApi.POST('/workouts', {
        body,
        params: { header: { 'Idempotency-Key': requestKey.current.key } },
      });
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (response.status !== 201 || !data) {
        setError(getCreateWorkoutErrorMessage(response.status));
        return;
      }
      setCreated(true);
      router.push(`/workouts/${data.id}`);
      router.refresh();
    } catch {
      setError(getCreateWorkoutErrorMessage());
    } finally {
      submitting.current = false;
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-7 px-6 py-12">
      <Link href="/workouts" className="text-sm text-muted-foreground hover:underline">
        ← Усі тренування
      </Link>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Створити тренування</h1>
        <p className="text-sm text-muted-foreground">
          Оберіть вправи, додайте підходи та задайте планові показники.
        </p>
      </div>
      <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-6">
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="space-y-1">
            <label htmlFor="workout-title" className="block text-sm font-medium">
              Назва тренування
            </label>
            <input
              id="workout-title"
              type="text"
              maxLength={120}
              disabled={busy}
              aria-invalid={Boolean(form.formState.errors.title)}
              {...form.register('title', { onChange: () => setError(null) })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            {form.formState.errors.title && (
              <p role="alert" className="text-xs text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor="workout-scheduled" className="block text-sm font-medium">
              Дата і час (необов’язково)
            </label>
            <input
              id="workout-scheduled"
              type="datetime-local"
              disabled={busy}
              {...form.register('scheduledAt', { onChange: () => setError(null) })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            {form.formState.errors.scheduledAt && (
              <p role="alert" className="text-xs text-destructive">
                {form.formState.errors.scheduledAt.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor="workout-notes" className="block text-sm font-medium">
              Нотатки
            </label>
            <textarea
              id="workout-notes"
              rows={2}
              maxLength={5000}
              disabled={busy}
              {...form.register('notes', { onChange: () => setError(null) })}
              className="w-full rounded-md border border-input bg-background p-3 text-sm"
            />
            {form.formState.errors.notes && (
              <p role="alert" className="text-xs text-destructive">
                {form.formState.errors.notes.message}
              </p>
            )}
          </div>
        </section>

        <WorkoutExercisePicker
          disabled={busy || fields.length >= 50}
          selectedIds={selectedExercises.map((exercise) => exercise.exerciseId)}
          onSelect={(exercise) => {
            if (fields.length >= 50) return;
            if (selectedExercises.some((item) => item.exerciseId === exercise.id)) return;
            append(createWorkoutExercise(exercise));
            form.clearErrors('exercises');
            setError(null);
          }}
        />

        <section className="space-y-4" aria-label="Вправи у тренуванні">
          <h2 className="text-xl font-semibold">Обрані вправи ({fields.length})</h2>
          {fields.length === 0 && (
            <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
              Додайте хоча б одну вправу з каталогу.
            </p>
          )}
          {fields.map((field, index) => (
            <WorkoutExerciseEditor
              key={field.id}
              index={index}
              form={form}
              disabled={busy}
              onRemove={() => remove(index)}
            />
          ))}
        </section>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || fields.length === 0}>
          {created
            ? 'Тренування створено'
            : form.formState.isSubmitting
              ? 'Створюємо…'
              : 'Зберегти тренування'}
        </Button>
      </form>
    </main>
  );
}
