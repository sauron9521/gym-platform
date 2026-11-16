'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';

import { Button } from '@/shared/ui/button';
import { useEditExerciseMutation } from '../api/exercise-mutations';
import {
  CREATE_EXERCISE_TYPES,
  createExerciseFormSchema as editExerciseSchema,
  type CustomExerciseActorRole,
} from '../lib/create-exercise';
import type { ExerciseDetailsData } from '../lib/exercise-catalog';
import {
  buildUpdateExercisePayload,
  getEditExerciseDefaults,
  type EditExerciseValues,
} from '../lib/manage-exercise';
import { useExerciseTaxonomy } from './use-exercise-taxonomy';

export function EditExerciseForm({
  exercise,
  role,
  onSaved,
  onCancel,
  onReload,
}: {
  exercise: ExerciseDetailsData;
  role: CustomExerciseActorRole;
  onSaved: (exercise: ExerciseDetailsData) => void;
  onCancel: () => void;
  onReload: () => void;
}) {
  const mutation = useEditExerciseMutation(exercise.id);
  const { state: taxonomy, retry: retryTaxonomy } = useExerciseTaxonomy();
  const [error, setError] = useState<string | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState('');
  const form = useForm<EditExerciseValues>({
    resolver: zodResolver(editExerciseSchema),
    defaultValues: getEditExerciseDefaults(exercise),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'muscleGroups',
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const busy = isSubmitting || mutation.isPending;
  const muscleOptions = taxonomy.kind === 'ready' ? taxonomy.muscleGroups : [];
  const equipmentOptions = taxonomy.kind === 'ready' ? taxonomy.equipment : [];

  async function submit(values: EditExerciseValues) {
    if (taxonomy.kind !== 'ready') {
      setError('Довідники ще не завантажено. Спробуйте оновити їх.');
      return;
    }
    const body = buildUpdateExercisePayload(values, exercise, role);
    if (Object.keys(body).length === 0) {
      onCancel();
      return;
    }
    setError(null);
    mutation.reset();

    try {
      const data = await mutation.mutateAsync(body);
      onSaved(data);
    } catch {
      // Keep form values; the mutation owns the status-specific error.
    }
  }

  function addMuscle() {
    if (!selectedMuscle || busy || taxonomy.kind !== 'ready' || fields.length >= 10) return;
    if (fields.some((field) => field.slug === selectedMuscle)) {
      setError('Цю групу вже додано.');
      return;
    }
    append({ slug: selectedMuscle, role: fields.length ? 'SECONDARY' : 'PRIMARY' });
    setSelectedMuscle('');
    setError(null);
    form.clearErrors('muscleGroups');
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="Редагування вправи">
      <h2 className="text-lg font-semibold">Редагувати вправу</h2>
      <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-5">
        {taxonomy.kind === 'loading' && (
          <p role="status" className="text-sm text-muted-foreground">
            Завантажуємо довідники…
          </p>
        )}
        {taxonomy.kind === 'error' && (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-destructive">{taxonomy.message}</p>
            <Button type="button" variant="outline" onClick={retryTaxonomy}>
              Повторити
            </Button>
          </div>
        )}
        <div className="space-y-1">
          <label htmlFor="edit-exercise-name" className="block text-sm font-medium">
            Назва
          </label>
          <input
            id="edit-exercise-name"
            type="text"
            maxLength={120}
            disabled={busy}
            {...form.register('name')}
            aria-invalid={Boolean(errors.name)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          {errors.name && (
            <p role="alert" className="text-xs text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="edit-exercise-type" className="block text-sm font-medium">
            Тип вправи
          </label>
          <select
            id="edit-exercise-type"
            disabled={busy}
            {...form.register('exerciseType')}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {CREATE_EXERCISE_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="edit-exercise-description" className="block text-sm font-medium">
            Опис
          </label>
          <textarea
            id="edit-exercise-description"
            rows={3}
            maxLength={5000}
            disabled={busy}
            {...form.register('description')}
            className="w-full rounded-md border border-input bg-background p-3 text-sm"
          />
          {errors.description && (
            <p role="alert" className="text-xs text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="edit-exercise-instructions" className="block text-sm font-medium">
            Інструкція
          </label>
          <textarea
            id="edit-exercise-instructions"
            rows={4}
            maxLength={10000}
            disabled={busy}
            {...form.register('instructions')}
            className="w-full rounded-md border border-input bg-background p-3 text-sm"
          />
          {errors.instructions && (
            <p role="alert" className="text-xs text-destructive">
              {errors.instructions.message}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="font-medium">М’язові групи</h3>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-44 flex-1 space-y-1">
              <label htmlFor="edit-exercise-muscle" className="block text-sm font-medium">
                Додати групу
              </label>
              <select
                id="edit-exercise-muscle"
                value={selectedMuscle}
                disabled={busy || taxonomy.kind !== 'ready' || fields.length >= 10}
                onChange={(event) => setSelectedMuscle(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Оберіть групу</option>
                {muscleOptions.map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={busy || taxonomy.kind !== 'ready' || !selectedMuscle || fields.length >= 10}
              onClick={addMuscle}
            >
              Додати
            </Button>
          </div>
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-wrap items-center gap-3">
              <input type="hidden" {...form.register(`muscleGroups.${index}.slug`)} />
              <span className="min-w-32 flex-1 text-sm">
                {muscleOptions.find((item) => item.slug === field.slug)?.name ?? field.slug}
              </span>
              <label htmlFor={`edit-exercise-role-${index}`} className="text-sm">
                Роль
              </label>
              <select
                id={`edit-exercise-role-${index}`}
                disabled={busy}
                defaultValue={field.role}
                {...form.register(`muscleGroups.${index}.role`)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="PRIMARY">Основна</option>
                <option value="SECONDARY">Допоміжна</option>
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => remove(index)}
              >
                Прибрати
              </Button>
            </div>
          ))}
          {errors.muscleGroups && (
            <p role="alert" className="text-sm text-destructive">
              Оберіть від 1 до 10 груп без повторів, принаймні одну основну.
            </p>
          )}
        </div>

        <fieldset className="space-y-3">
          <legend className="font-medium">Обладнання</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {equipmentOptions.map((item) => (
              <label key={item.slug} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={item.slug}
                  disabled={busy}
                  {...form.register('equipment')}
                />
                {item.name}
              </label>
            ))}
          </div>
          {errors.equipment && (
            <p role="alert" className="text-sm text-destructive">
              Оберіть не більш ніж 20 різних видів обладнання.
            </p>
          )}
        </fieldset>

        {role === 'ATHLETE' && (
          <div className="space-y-1">
            <label htmlFor="edit-exercise-visibility" className="block text-sm font-medium">
              Приватність
            </label>
            <select
              id="edit-exercise-visibility"
              disabled={busy}
              {...form.register('visibility')}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="PRIVATE">Приватна</option>
              <option value="SELECTED_TRAINERS">Для обраних тренерів</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Доступ тренерам потребує окремого дозволу та активних відносин.
            </p>
          </div>
        )}

        {(error || mutation.isError) && (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-destructive">{error ?? mutation.error?.message}</p>
            <Button type="button" variant="outline" disabled={busy} onClick={onReload}>
              Оновити вправу
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !isDirty || taxonomy.kind !== 'ready'}>
            {busy ? 'Зберігаємо…' : 'Зберегти зміни'}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Скасувати
          </Button>
        </div>
      </form>
    </section>
  );
}
