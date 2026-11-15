'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useCreateTrainingProgramMutation } from '../api/training-program-mutations';
import { Button } from '@/shared/ui/button';
import { createTrainingProgramFormSchema, type CreateTrainingProgramValues } from '../lib/create-training-program';

export function CreateTrainingProgramForm() {
  const router = useRouter();
  const mutation = useCreateTrainingProgramMutation();
  const [created, setCreated] = useState(false);
  const form = useForm<CreateTrainingProgramValues>({
    resolver: zodResolver(createTrainingProgramFormSchema),
    defaultValues: { title: '', description: '', durationWeeks: '' },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const { errors, isSubmitting } = form.formState;
  const busy = isSubmitting || mutation.isPending || created;

  async function submit(values: CreateTrainingProgramValues) {
    if (busy) return;
    mutation.reset();
    try {
      await mutation.mutateAsync(values);
      setCreated(true);
      // The API creates v1 as a draft; the list cache is invalidated on success.
      router.push('/trainer/programs');
      router.refresh();
    } catch {
      // Safe mutation errors remain visible and 401 redirects are handled centrally.
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-7 px-6 py-12">
      <Link href="/trainer/programs" className="text-sm text-muted-foreground hover:underline">
        ← До тренувальних програм
      </Link>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Створити програму</h1>
        <p className="text-sm text-muted-foreground">
          Збережіть назву, опис і тривалість. Перша версія створюється як чернетка. Наступним кроком
          можна буде додати тренування та вправи.
        </p>
      </header>

      <form
        onSubmit={(event) => void form.handleSubmit(submit)(event)}
        noValidate
        className="space-y-6"
      >
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="space-y-1">
            <label htmlFor="training-program-title" className="block text-sm font-medium">
              Назва програми
            </label>
            <input
              id="training-program-title"
              type="text"
              maxLength={120}
              autoComplete="off"
              disabled={busy}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'training-program-title-error' : undefined}
              {...form.register('title', { onChange: () => mutation.reset() })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            {errors.title && (
              <p
                id="training-program-title-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.title.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor="training-program-description" className="block text-sm font-medium">
              Опис (необов’язково)
            </label>
            <textarea
              id="training-program-description"
              rows={4}
              maxLength={5000}
              disabled={busy}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? 'training-program-description-error' : undefined
              }
              {...form.register('description', { onChange: () => mutation.reset() })}
              className="w-full rounded-md border border-input bg-background p-3 text-sm"
            />
            {errors.description && (
              <p
                id="training-program-description-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.description.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor="training-program-duration" className="block text-sm font-medium">
              Тривалість у тижнях (необов’язково)
            </label>
            <input
              id="training-program-duration"
              type="text"
              inputMode="numeric"
              maxLength={2}
              autoComplete="off"
              placeholder="Наприклад, 8"
              disabled={busy}
              aria-invalid={Boolean(errors.durationWeeks)}
              aria-describedby={
                errors.durationWeeks ? 'training-program-duration-error' : undefined
              }
              {...form.register('durationWeeks', { onChange: () => mutation.reset() })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            {errors.durationWeeks && (
              <p
                id="training-program-duration-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.durationWeeks.message}
              </p>
            )}
          </div>
        </section>

        {mutation.isError && mutation.error.status !== 401 && (
          <p role="alert" className="text-sm text-destructive">
            {mutation.error.message}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            {created ? 'Чернетку створено' : busy ? 'Створюємо…' : 'Створити чернетку'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/trainer/programs">Скасувати</Link>
          </Button>
        </div>
      </form>
    </main>
  );
}
