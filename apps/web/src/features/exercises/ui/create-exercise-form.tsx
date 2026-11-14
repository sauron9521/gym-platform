'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import {
  buildCreateExercisePayload,
  CREATE_EXERCISE_TYPES,
  createExerciseFormSchema,
  getCreateExerciseErrorMessage,
  type CreateExerciseValues,
  type CustomExerciseActorRole,
} from '../lib/create-exercise';
import { useExerciseTaxonomy } from './use-exercise-taxonomy';

export function CreateExerciseForm({ role }: { role: CustomExerciseActorRole }) {
  const router = useRouter();
  const { state: taxonomy, retry: retryTaxonomy } = useExerciseTaxonomy();
  const [selectedMuscle, setSelectedMuscle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const form = useForm<CreateExerciseValues>({
    resolver: zodResolver(createExerciseFormSchema),
    defaultValues: {
      name: '',
      description: '',
      instructions: '',
      exerciseType: 'STRENGTH',
      visibility: 'PRIVATE',
      muscleGroups: [],
      equipment: [],
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'muscleGroups',
  });
  const { errors, isSubmitting } = form.formState;
  const busy = isSubmitting || created;
  const muscleOptions = taxonomy.kind === 'ready' ? taxonomy.muscleGroups : [];
  const equipmentOptions = taxonomy.kind === 'ready' ? taxonomy.equipment : [];

  function addMuscle() {
    if (!selectedMuscle || busy || taxonomy.kind !== 'ready' || fields.length >= 10) return;
    if (fields.some((item) => item.slug === selectedMuscle)) {
      setError('Цю м’язову групу вже додано.');
      return;
    }
    append({ slug: selectedMuscle, role: fields.length === 0 ? 'PRIMARY' : 'SECONDARY' });
    setSelectedMuscle('');
    setError(null);
    form.clearErrors('muscleGroups');
  }

  async function submit(values: CreateExerciseValues) {
    if (created) return;
    if (taxonomy.kind !== 'ready') {
      setError('Довідники ще не завантажено. Оновіть їх перед збереженням.');
      return;
    }
    setError(null);
    try {
      const { data, response } = await webApi.POST('/exercises', {
        body: buildCreateExercisePayload(values, role),
      });
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (response.status !== 201 || !data) {
        setError(getCreateExerciseErrorMessage(response.status));
        return;
      }
      setCreated(true);
      router.push(`/exercises/${data.id}`);
      router.refresh();
    } catch {
      setError(getCreateExerciseErrorMessage());
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-7 px-6 py-12">
      <Link href="/exercises" className="text-sm text-muted-foreground hover:underline">
        ← До каталогу вправ
      </Link>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Створити власну вправу</h1>
        <p className="text-sm text-muted-foreground">
          Вкажіть основні м’язи, обладнання та інструкцію. Поля зберігаються у вашій бібліотеці.
        </p>
      </header>

      <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-6">
        {taxonomy.kind === 'loading' && (
          <p role="status" className="text-sm text-muted-foreground">Завантажуємо довідники…</p>
        )}
        {taxonomy.kind === 'error' && (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-destructive">{taxonomy.message}</p>
            <Button type="button" variant="outline" onClick={retryTaxonomy}>Повторити</Button>
          </div>
        )}
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Основна інформація</h2>
          <div className="space-y-1">
            <label htmlFor="create-exercise-name" className="block text-sm font-medium">
              Назва
            </label>
            <input
              id="create-exercise-name"
              type="text"
              maxLength={120}
              disabled={busy}
              aria-invalid={Boolean(errors.name)}
              {...form.register('name', { onChange: () => setError(null) })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            {errors.name && (
              <p role="alert" className="text-xs text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor="create-exercise-type" className="block text-sm font-medium">
              Тип вправи
            </label>
            <select
              id="create-exercise-type"
              disabled={busy}
              {...form.register('exerciseType')}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {CREATE_EXERCISE_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="create-exercise-description" className="block text-sm font-medium">
              Опис
            </label>
            <textarea
              id="create-exercise-description"
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
            <label htmlFor="create-exercise-instructions" className="block text-sm font-medium">
              Техніка виконання
            </label>
            <textarea
              id="create-exercise-instructions"
              rows={5}
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
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">М’язові групи</h2>
          <p className="text-sm text-muted-foreground">
            Додайте хоча б одну основну групу м’язів, максимум 10.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1 space-y-1">
              <label htmlFor="create-exercise-muscle" className="block text-sm font-medium">
                Група м’язів
              </label>
              <select
                id="create-exercise-muscle"
                value={selectedMuscle}
                disabled={busy || taxonomy.kind !== 'ready' || fields.length >= 10}
                onChange={(event) => setSelectedMuscle(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Оберіть зі списку</option>
                {muscleOptions.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
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
              Додати групу
            </Button>
          </div>
          {fields.length > 0 && (
            <ul className="space-y-3">
              {fields.map((field, index) => (
                <li key={field.id} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" {...form.register(`muscleGroups.${index}.slug`)} />
                  <span className="min-w-40 flex-1 text-sm font-medium">
                    {muscleOptions.find((item) => item.slug === field.slug)?.name ?? field.slug}
                  </span>
                  <label className="text-sm" htmlFor={`create-exercise-role-${index}`}>
                    Роль
                  </label>
                  <select
                    id={`create-exercise-role-${index}`}
                    disabled={busy}
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
                </li>
              ))}
            </ul>
          )}
          {errors.muscleGroups && (
            <p role="alert" className="text-sm text-destructive">
              Перевірте м’язові групи: потрібна основна група без повторів.
            </p>
          )}
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Обладнання</h2>
          <p className="text-sm text-muted-foreground">
            Оберіть потрібне обладнання (необов’язково, максимум 20 позицій).
          </p>
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
        </section>

        {role === 'ATHLETE' && (
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Приватність</h2>
            <label htmlFor="create-exercise-visibility" className="block text-sm font-medium">
              Видимість вправи
            </label>
            <select
              id="create-exercise-visibility"
              disabled={busy}
              {...form.register('visibility')}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="PRIVATE">Приватна</option>
              <option value="SELECTED_TRAINERS">Для обраних тренерів</option>
            </select>
            <p className="text-sm text-muted-foreground">
              Для доступу тренера потрібні активні відносини та окремий дозвіл. Сам вибір видимості
              не надає доступ автоматично.
            </p>
          </section>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy || taxonomy.kind !== 'ready'}>
            {created ? 'Вправу створено' : isSubmitting ? 'Створюємо…' : 'Створити вправу'}
          </Button>
          <Button asChild variant="outline">
            <Link href="/exercises">До каталогу</Link>
          </Button>
        </div>
      </form>
    </main>
  );
}
