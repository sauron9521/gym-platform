'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import {
  getExerciseDetailsErrorMessage,
  getExerciseSourceLabel,
  getExerciseTypeLabel,
  type ExerciseDetailsData,
} from '../lib/exercise-catalog';

type DetailsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; exercise: ExerciseDetailsData };

export function ExerciseDetails({ id }: { id: string }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DetailsState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    void webApi
      .GET('/exercises/{id}', { params: { path: { id } } })
      .then(({ data, response }) => {
        if (!active) return;
        if (response.status === 401) {
          router.replace('/login');
          return;
        }
        if (response.status !== 200 || !data || data.isArchived) {
          setState({
            kind: 'error',
            message: getExerciseDetailsErrorMessage(
              data?.isArchived ? 404 : response.status,
            ),
          });
          return;
        }
        setState({ kind: 'ready', exercise: data });
      })
      .catch(() => {
        if (active) setState({ kind: 'error', message: getExerciseDetailsErrorMessage() });
      });

    return () => {
      active = false;
    };
  }, [id, attempt, router]);

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((current) => current + 1);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-7 px-6 py-12">
      <Link href="/exercises" className="text-sm text-muted-foreground hover:underline">
        ← Каталог вправ
      </Link>

      {state.kind === 'loading' && (
        <p role="status" className="rounded-xl border bg-card p-6 text-muted-foreground">
          Завантажуємо вправу…
        </p>
      )}

      {state.kind === 'error' && (
        <div role="alert" className="space-y-3 rounded-xl border bg-card p-6">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button type="button" variant="outline" onClick={retry}>
            Спробувати ще раз
          </Button>
        </div>
      )}

      {state.kind === 'ready' && (
        <>
          <header className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">{state.exercise.name}</h1>
            <p className="text-sm text-muted-foreground">
              {getExerciseTypeLabel(state.exercise.exerciseType)} ·{' '}
              {getExerciseSourceLabel(state.exercise.source)}
            </p>
            {state.exercise.description && (
              <p className="whitespace-pre-wrap text-sm">{state.exercise.description}</p>
            )}
          </header>

          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">М’язові групи</h2>
            {state.exercise.muscleGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Не вказані.</p>
            ) : (
              <ul className="space-y-2">
                {state.exercise.muscleGroups.map((item) => (
                  <li key={item.muscleGroup.id} className="text-sm">
                    {item.muscleGroup.name}{' '}
                    <span className="text-muted-foreground">
                      ({item.role === 'PRIMARY' ? 'основна' : 'допоміжна'})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Обладнання</h2>
            {state.exercise.equipment.length === 0 ? (
              <p className="text-sm text-muted-foreground">Не потрібне або не вказане.</p>
            ) : (
              <ul className="list-inside list-disc space-y-1 text-sm">
                {state.exercise.equipment.map((item) => (
                  <li key={item.equipment.id}>{item.equipment.name}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Техніка виконання</h2>
            {state.exercise.instructions ? (
              <p className="whitespace-pre-wrap text-sm">{state.exercise.instructions}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Інструкцію поки не додано.</p>
            )}
          </section>

          <Button asChild>
            <Link href="/workouts/new">Створити тренування</Link>
          </Button>
        </>
      )}
    </main>
  );
}
