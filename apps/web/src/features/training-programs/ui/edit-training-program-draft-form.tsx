'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useUpdateTrainingProgramDraftMutation } from '../api/training-program-mutations';
import { Button } from '@/shared/ui/button';
import { createTrainingProgramFormSchema } from '../lib/create-training-program';
import {
  toTrainingProgramDraftValues,
  type EditTrainingProgramDraftValues,
} from '../lib/edit-training-program-draft';
import type { TrainingProgramVersionItem } from '../lib/training-programs-list';

export function EditTrainingProgramDraftForm({
  programId,
  version,
}: {
  programId: string;
  version: TrainingProgramVersionItem;
}) {
  const mutation = useUpdateTrainingProgramDraftMutation(programId, version.id);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);
  const form = useForm<EditTrainingProgramDraftValues>({
    resolver: zodResolver(createTrainingProgramFormSchema),
    defaultValues: toTrainingProgramDraftValues(version),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const { errors, isSubmitting } = form.formState;
  const busy = isSubmitting || mutation.isPending;
  const error =
    validationError ??
    (mutation.isError && mutation.error.status !== 401 ? mutation.error.message : null);

  function changed() {
    setValidationError(null);
    mutation.reset();
    setSaved(false);
    setHasChanged(true);
  }

  function invalid() {
    setSaved(false);
    setValidationError('Перевірте поля форми та виправте помилки.');
  }

  async function submit(values: EditTrainingProgramDraftValues) {
    if (mutation.isPending) return;
    setValidationError(null);
    mutation.reset();
    setSaved(false);
    try {
      const updated = await mutation.mutateAsync(values);
      form.reset(toTrainingProgramDraftValues(updated));
      setHasChanged(false);
      setSaved(true);
    } catch {
      // Safe mutation errors remain in the hook; 401 clears private state and redirects.
    }
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="Редагування чернетки">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Редагувати чернетку v{version.version}</h2>
        <p className="text-sm text-muted-foreground">
          Зміни зберігаються тільки для чернетки. Опубліковані версії незмінні.
        </p>
      </div>
      <form
        onSubmit={(event) => void form.handleSubmit(submit, invalid)(event)}
        noValidate
        className="space-y-4"
      >
        <div className="space-y-1">
          <label htmlFor="program-draft-title" className="block text-sm font-medium">
            Назва програми
          </label>
          <input
            id="program-draft-title"
            type="text"
            maxLength={120}
            disabled={busy}
            aria-invalid={Boolean(errors.title)}
            {...form.register('title', { onChange: changed })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          {errors.title && (
            <p role="alert" className="text-xs text-destructive">
              {errors.title.message}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor="program-draft-description" className="block text-sm font-medium">
            Опис (необов’язково)
          </label>
          <textarea
            id="program-draft-description"
            rows={4}
            maxLength={5000}
            disabled={busy}
            aria-invalid={Boolean(errors.description)}
            {...form.register('description', { onChange: changed })}
            className="w-full rounded-md border border-input bg-background p-3 text-sm"
          />
          {errors.description && (
            <p role="alert" className="text-xs text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor="program-draft-duration" className="block text-sm font-medium">
            Тривалість у тижнях (необов’язково)
          </label>
          <input
            id="program-draft-duration"
            type="text"
            inputMode="numeric"
            maxLength={2}
            placeholder="Наприклад, 8"
            disabled={busy}
            aria-invalid={Boolean(errors.durationWeeks)}
            {...form.register('durationWeeks', { onChange: changed })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          {errors.durationWeeks && (
            <p role="alert" className="text-xs text-destructive">
              {errors.durationWeeks.message}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm">
            Зміни збережено
          </p>
        )}
        <Button
          type="button"
          disabled={!hasChanged || busy}
          onClick={() => void form.handleSubmit(submit, invalid)()}
        >
          {busy ? 'Зберігаємо…' : 'Зберегти зміни'}
        </Button>
      </form>
    </section>
  );
}
