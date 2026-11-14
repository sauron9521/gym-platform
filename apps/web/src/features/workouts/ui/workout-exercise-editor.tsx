'use client';

import { useFieldArray, type UseFormReturn } from 'react-hook-form';

import { Button } from '@/shared/ui/button';
import {
  createEmptyWorkoutSet,
  workoutSetTypes,
  type CreateWorkoutValues,
} from '../lib/create-workout';

const setTypeLabels: Record<(typeof workoutSetTypes)[number], string> = {
  WARMUP: 'Розминка',
  WORKING: 'Робочий',
  DROP_SET: 'Дроп-сет',
  AMRAP: 'До відмови',
};

const plannedFields = [
  { name: 'plannedReps', label: 'Повторення' },
  { name: 'plannedWeightKg', label: 'Вага (кг)' },
  { name: 'plannedDurationSeconds', label: 'Час (с)' },
  { name: 'plannedDistanceMeters', label: 'Дистанція (м)' },
  { name: 'restSeconds', label: 'Відпочинок (с)' },
  { name: 'targetRpe', label: 'Цільовий RPE' },
  { name: 'targetRir', label: 'Цільовий RIR' },
] as const;

export function WorkoutExerciseEditor({
  index,
  form,
  disabled,
  onRemove,
}: {
  index: number;
  form: UseFormReturn<CreateWorkoutValues>;
  disabled: boolean;
  onRemove: () => void;
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `exercises.${index}.sets`,
  });
  const name = form.watch(`exercises.${index}.exerciseName`);
  const exerciseError = form.formState.errors.exercises?.[index];

  return (
    <article className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{name}</h3>
        <Button type="button" variant="outline" disabled={disabled} onClick={onRemove}>
          Прибрати вправу
        </Button>
      </div>
      <div className="space-y-1">
        <label htmlFor={`exercise-${index}-notes`} className="block text-sm font-medium">
          Нотатки до вправи
        </label>
        <textarea
          id={`exercise-${index}-notes`}
          rows={2}
          maxLength={5000}
          disabled={disabled}
          {...form.register(`exercises.${index}.notes`)}
          className="w-full rounded-md border border-input bg-background p-3 text-sm"
        />
        {exerciseError?.notes?.message && (
          <p role="alert" className="text-xs text-destructive">
            {exerciseError.notes.message}
          </p>
        )}
      </div>
      <div className="space-y-3">
        <h4 className="font-medium">Підходи ({fields.length})</h4>
        {fields.map((field, setIndex) => (
          <div key={field.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">Підхід {setIndex + 1}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || fields.length <= 1}
                onClick={() => remove(setIndex)}
              >
                Прибрати
              </Button>
            </div>
            <div className="space-y-1">
              <label
                htmlFor={`exercise-${index}-set-${setIndex}-type`}
                className="block text-sm font-medium"
              >
                Тип підходу
              </label>
              <select
                id={`exercise-${index}-set-${setIndex}-type`}
                disabled={disabled}
                {...form.register(`exercises.${index}.sets.${setIndex}.setType`)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {workoutSetTypes.map((type) => (
                  <option key={type} value={type}>
                    {setTypeLabels[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {plannedFields.map(({ name: key, label }) => {
                const fieldId = `exercise-${index}-set-${setIndex}-${key}`;
                const error = exerciseError?.sets?.[setIndex]?.[key]?.message;
                return (
                  <div key={key} className="space-y-1">
                    <label htmlFor={fieldId} className="block text-sm font-medium">
                      {label}
                    </label>
                    <input
                      id={fieldId}
                      type="text"
                      inputMode="decimal"
                      disabled={disabled}
                      aria-invalid={Boolean(error)}
                      {...form.register(`exercises.${index}.sets.${setIndex}.${key}`)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    />
                    {error && (
                      <p role="alert" className="text-xs text-destructive">
                        {error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {exerciseError?.sets?.root?.message && (
          <p role="alert" className="text-sm text-destructive">
            {exerciseError.sets.root.message}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={disabled || fields.length >= 100}
          onClick={() => append(createEmptyWorkoutSet())}
        >
          Додати підхід
        </Button>
      </div>
    </article>
  );
}
