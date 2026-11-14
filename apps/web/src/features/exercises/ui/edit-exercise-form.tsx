'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import {
  CREATE_EXERCISE_TYPES,
  EQUIPMENT_OPTIONS,
  MUSCLE_OPTIONS,
  type CustomExerciseActorRole,
} from '../lib/create-exercise';
import type { ExerciseDetailsData } from '../lib/exercise-catalog';
import {
  buildUpdateExercisePayload,
  editExerciseSchema,
  getEditExerciseDefaults,
  getExerciseMutationErrorMessage,
  type EditExerciseValues,
} from '../lib/manage-exercise';

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
  const router = useRouter();
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

  async function submit(values: EditExerciseValues) {
    if (isSubmitting) return;
    const body = buildUpdateExercisePayload(values, exercise, role);
    if (Object.keys(body).length === 0) {
      onCancel();
      return;
    }
    setError(null);

    try {
      const { data, response } = await webApi.PATCH('/exercises/{id}', {
        params: { path: { id: exercise.id } },
        body,
      });
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (response.status !== 200 || !data) {
        setError(getExerciseMutationErrorMessage(response.status));
        return;
      }
      onSaved(data);
    } catch {
      setError(getExerciseMutationErrorMessage());
    }
  }

  function addMuscle() {
    if (!selectedMuscle || isSubmitting || fields.length >= 10) return;
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
        <div className="space-y-1">
          <label htmlFor="edit-exercise-name" className="block text-sm font-medium">
            Назва
          </label>
          <input
            id="edit-exercise-name"
            type="text"
            maxLength={120}
            disabled={isSubmitting}
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
            disabled={isSubmitting}
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
            disabled={isSubmitting}
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
            disabled={isSubmitting}
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
                disabled={isSubmitting || fields.length >= 10}
                onChange={(event) => setSelectedMuscle(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Оберіть групу</option>
                {MUSCLE_OPTIONS.map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || !selectedMuscle || fields.length >= 10}
              onClick={addMuscle}
            >
              Додати
            </Button>
          </div>
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-wrap items-center gap-3">
              <input type="hidden" {...form.register(`muscleGroups.${index}.slug`)} />
              <span className="min-w-32 flex-1 text-sm">
                {MUSCLE_OPTIONS.find((item) => item.slug === field.slug)?.label ?? field.slug}
              </span>
              <label htmlFor={`edit-exercise-role-${index}`} className="text-sm">
                Роль
              </label>
              <select
                id={`edit-exercise-role-${index}`}
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
            {EQUIPMENT_OPTIONS.map((item) => (
              <label key={item.slug} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={item.slug}
                  disabled={isSubmitting}
                  {...form.register('equipment')}
                />
                {item.label}
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
              disabled={isSubmitting}
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

        {error && (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onReload}>
              Оновити вправу
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? 'Зберігаємо…' : 'Зберегти зміни'}
          </Button>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Скасувати
          </Button>
        </div>
      </form>
    </section>
  );
}
