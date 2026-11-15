'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import {
  buildUpdateTrainingProgramDraftPayload,
  editTrainingProgramDraftSchema,
  getUpdateTrainingProgramDraftError,
  toTrainingProgramDraftValues,
  type EditTrainingProgramDraftValues,
} from '../lib/edit-training-program-draft';
import type { TrainingProgramVersionItem } from '../lib/training-programs-list';

export function EditTrainingProgramDraftForm({
  programId,
  version,
  onUpdated,
}: {
  programId: string;
  version: TrainingProgramVersionItem;
  onUpdated: (version: TrainingProgramVersionItem) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const form = useForm<EditTrainingProgramDraftValues>({
    resolver: zodResolver(editTrainingProgramDraftSchema),
    defaultValues: toTrainingProgramDraftValues(version),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const { errors, isDirty, isSubmitting } = form.formState;

  function changed() {
    setError(null);
    setSaved(false);
  }

  async function submit(values: EditTrainingProgramDraftValues) {
    if (!form.formState.isDirty) return;
    setError(null);
    setSaved(false);
    try {
      const { data, response } = await webApi.PATCH(
        '/training-programs/{programId}/versions/{versionId}',
        {
          params: { path: { programId, versionId: version.id } },
          body: buildUpdateTrainingProgramDraftPayload(values),
        },
      );
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (response.status !== 200 || !data) {
        setError(getUpdateTrainingProgramDraftError(response.status));
        return;
      }

      onUpdated(data);
      form.reset(toTrainingProgramDraftValues(data));
      setSaved(true);
    } catch {
      setError(getUpdateTrainingProgramDraftError());
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
        onSubmit={(event) => void form.handleSubmit(submit)(event)}
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
            disabled={isSubmitting}
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
            disabled={isSubmitting}
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
            disabled={isSubmitting}
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
        <Button type="submit" disabled={!isDirty || isSubmitting}>
          {isSubmitting ? 'Зберігаємо…' : 'Зберегти зміни'}
        </Button>
      </form>
    </section>
  );
}
