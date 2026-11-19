'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/shared/ui/button';
import { useUpdateWorkoutSetMutation } from '../api/workout-set-mutation';
import {
  buildWorkoutSetPayload,
  getWorkoutSetDefaults,
  getWorkoutSetPlanSuggestion,
  workoutSetFormSchema,
  type WorkoutSetData,
  type WorkoutSetFormValues,
} from '../lib/workout-set-form';

type NumericField = Exclude<keyof WorkoutSetFormValues, 'notes'>;
type Field = { name: NumericField; label: string; inputMode: 'numeric' | 'decimal' };

const primaryFields: ReadonlyArray<Field> = [
  { name: 'actualReps', label: 'Повторення', inputMode: 'numeric' },
  { name: 'actualWeightKg', label: 'Вага (кг)', inputMode: 'decimal' },
];

const additionalFields: ReadonlyArray<Field> = [
  { name: 'actualDurationSeconds', label: 'Тривалість (с)', inputMode: 'numeric' },
  { name: 'actualDistanceMeters', label: 'Дистанція (м)', inputMode: 'decimal' },
  { name: 'restSeconds', label: 'Відпочинок (с)', inputMode: 'numeric' },
  { name: 'rpe', label: 'RPE', inputMode: 'decimal' },
  { name: 'rir', label: 'RIR', inputMode: 'numeric' },
];

export function WorkoutSetForm({
  workoutId,
  set,
  onSaved,
  onSavedAndNext,
  onClose,
}: {
  workoutId: string;
  set: WorkoutSetData;
  onSaved: () => void;
  onSavedAndNext?: () => void;
  onClose: () => void;
}) {
  const mutation = useUpdateWorkoutSetMutation(workoutId);
  // A synchronous lock covers rapid taps before React paints isPending/disabled.
  const requestInFlight = useRef(false);
  const plan = getWorkoutSetPlanSuggestion(set);
  const [invalidAdvancedField, setInvalidAdvancedField] = useState<string | null>(null);
  const [showAdditional, setShowAdditional] = useState(
    () =>
      set.actualDurationSeconds !== null ||
      set.actualDistanceMeters !== null ||
      set.restSeconds !== null ||
      set.rpe !== null ||
      set.rir !== null ||
      Boolean(set.notes),
  );
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<WorkoutSetFormValues>({
    resolver: zodResolver(workoutSetFormSchema),
    defaultValues: getWorkoutSetDefaults(set),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const busy = isSubmitting || mutation.isPending;
  const notesErrorId = `workout-set-${set.id}-notes-error`;

  // Keep the opened editor keyboard-ready without moving the viewport.
  useEffect(() => {
    document.getElementById(`workout-set-${set.id}-actualReps`)?.focus({ preventScroll: true });
  }, [set.id]);

  // An invalid advanced input cannot receive focus until its disclosure opens.
  useEffect(() => {
    if (showAdditional && invalidAdvancedField) {
      document.getElementById(`workout-set-${set.id}-${invalidAdvancedField}`)?.focus({
        preventScroll: true,
      });
    }
  }, [showAdditional, invalidAdvancedField, set.id]);

  async function send(
    status: 'COMPLETED' | 'SKIPPED',
    values: WorkoutSetFormValues,
    advance = false,
  ) {
    if (requestInFlight.current || mutation.isPending) return;
    requestInFlight.current = true;
    mutation.reset();
    try {
      await mutation.mutateAsync({
        setId: set.id,
        body: buildWorkoutSetPayload(status, values),
      });
      toast.success(
        status === 'COMPLETED' ? 'Результат підходу збережено.' : 'Підхід позначено пропущеним.',
      );
      if (advance && onSavedAndNext) onSavedAndNext();
      else onSaved();
    } catch {
      // Mutation holds the status-specific error without dropping form values.
    } finally {
      requestInFlight.current = false;
    }
  }

  function skip() {
    if (busy || requestInFlight.current) return;
    void send('SKIPPED', getWorkoutSetDefaults(set));
  }

  function showValidationErrors(errors: Partial<Record<keyof WorkoutSetFormValues, unknown>>) {
    const firstAdvancedError =
      additionalFields.find(({ name }) => errors[name])?.name ?? (errors.notes ? 'notes' : null);
    if (firstAdvancedError) {
      setInvalidAdvancedField(firstAdvancedError);
      setShowAdditional(true);
    }
  }

  function submitCompleted(event: FormEvent<HTMLFormElement>) {
    void handleSubmit((values) => send('COMPLETED', values), showValidationErrors)(event);
  }

  function submitAndNext() {
    if (busy || requestInFlight.current) return;
    void handleSubmit((values) => send('COMPLETED', values, true), showValidationErrors)();
  }

  function applyPlan() {
    if (busy || requestInFlight.current) return;
    if (plan.actualReps !== null) {
      setValue('actualReps', plan.actualReps, { shouldDirty: true, shouldValidate: true });
    }
    if (plan.actualWeightKg !== null) {
      setValue('actualWeightKg', plan.actualWeightKg, { shouldDirty: true, shouldValidate: true });
    }
    mutation.reset();
  }

  function renderField({ name, label, inputMode }: Field) {
    const errorId = `workout-set-${set.id}-${name}-error`;
    const fieldId = `workout-set-${set.id}-${name}`;
    return (
      <div key={name} className="min-w-0 space-y-1">
        <label htmlFor={fieldId} className="block text-sm font-medium">
          {label}
        </label>
        <input
          id={fieldId}
          type="text"
          inputMode={inputMode}
          disabled={busy}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? errorId : undefined}
          {...register(name, { onChange: () => mutation.reset() })}
          className="h-12 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive"
        />
        {errors[name] && (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {errors[name].message}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={submitCompleted}
      noValidate
      aria-busy={busy}
      className="min-w-0 space-y-4 rounded-lg border bg-muted/30 p-3 sm:p-4"
      aria-label="Запис результатів підходу"
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Основні показники</p>
          {(plan.actualReps !== null || plan.actualWeightKg !== null) && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              disabled={busy}
              onClick={applyPlan}
            >
              Підставити план
            </Button>
          )}
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {primaryFields.map(renderField)}
        </div>
        {(plan.actualReps !== null || plan.actualWeightKg !== null) && (
          <p className="text-xs text-muted-foreground">
            Планові значення підставляються лише після натискання — перевірте фактичний результат.
          </p>
        )}
      </div>
      <details
        open={showAdditional}
        onToggle={(event) => setShowAdditional(event.currentTarget.open)}
        className="min-w-0 rounded-lg border bg-card p-3"
      >
        <summary className="min-h-11 cursor-pointer rounded-sm py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          Додаткові показники та нотатки
        </summary>
        <div className="space-y-4 pt-3">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {additionalFields.map(renderField)}
          </div>
          <div className="space-y-1">
            <label htmlFor={`workout-set-${set.id}-notes`} className="block text-sm font-medium">
              Нотатки
            </label>
            <textarea
              id={`workout-set-${set.id}-notes`}
              rows={2}
              disabled={busy}
              aria-invalid={Boolean(errors.notes)}
              aria-describedby={errors.notes ? notesErrorId : undefined}
              {...register('notes', { onChange: () => mutation.reset() })}
              className="min-h-24 w-full min-w-0 rounded-md border border-input bg-background p-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive"
            />
            {errors.notes && (
              <p id={notesErrorId} role="alert" className="text-xs text-destructive">
                {errors.notes.message}
              </p>
            )}
          </div>
        </div>
      </details>
      {busy && (
        <p role="status" aria-live="polite" className="text-sm font-medium text-primary">
          {mutation.isPending
            ? mutation.variables?.body.status === 'SKIPPED'
              ? 'Зберігаємо пропуск підходу…'
              : 'Зберігаємо результат підходу…'
            : 'Перевіряємо дані підходу…'}
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message}
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={busy}>
          {isSubmitting || (mutation.isPending && mutation.variables?.body.status === 'COMPLETED')
            ? 'Зберігаємо…'
            : 'Позначити виконаним'}
        </Button>
        {onSavedAndNext && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            disabled={busy}
            onClick={submitAndNext}
          >
            Зберегти й наступний
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          disabled={busy}
          onClick={() => void skip()}
        >
          {mutation.isPending && mutation.variables?.body.status === 'SKIPPED'
            ? 'Пропускаємо…'
            : 'Пропустити підхід'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          disabled={busy}
          onClick={onClose}
        >
          Закрити
        </Button>
      </div>
    </form>
  );
}
