'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';
import type { AuthenticatedUser } from '@/shared/api/server-session';
import { Button } from '@/shared/ui/button';
import { EditExerciseForm } from './edit-exercise-form';
import { canManageCustomExercise, getExerciseMutationErrorMessage } from '../lib/manage-exercise';
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

export function ExerciseDetails({ id, actor }: { id: string; actor: AuthenticatedUser }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DetailsState>({ kind: 'loading' });
  const [editing, setEditing] = useState(false);
  const [archiveConfirmation, setArchiveConfirmation] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

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
            message: getExerciseDetailsErrorMessage(data?.isArchived ? 404 : response.status),
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
    setEditing(false);
    setArchiveConfirmation(false);
    setArchiveError(null);
    setState({ kind: 'loading' });
    setAttempt((current) => current + 1);
  }

  async function archive() {
    if (
      archiving ||
      !archiveConfirmation ||
      state.kind !== 'ready' ||
      !canManageCustomExercise(state.exercise, actor)
    ) {
      return;
    }

    setArchiving(true);
    setArchiveError(null);
    try {
      const { data, response } = await webApi.DELETE('/exercises/{id}', {
        params: { path: { id: state.exercise.id } },
      });
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (response.status !== 200 || !data?.isArchived) {
        setArchiveError(getExerciseMutationErrorMessage(response.status));
        return;
      }
      router.replace('/exercises');
      router.refresh();
    } catch {
      setArchiveError(getExerciseMutationErrorMessage());
    } finally {
      setArchiving(false);
    }
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
          {canManageCustomExercise(state.exercise, actor) && !editing && (
            <section className="space-y-3" aria-label="Керування власною вправою">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={archiving}
                  onClick={() => {
                    setEditing(true);
                    setArchiveConfirmation(false);
                    setArchiveError(null);
                  }}
                >
                  Редагувати
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={archiving}
                  onClick={() => {
                    setArchiveConfirmation(true);
                    setArchiveError(null);
                  }}
                >
                  Архівувати
                </Button>
              </div>
              {archiveConfirmation && (
                <div
                  role="group"
                  aria-label="Підтвердження архівування"
                  className="space-y-3 rounded-xl border p-4"
                >
                  <p className="text-sm">
                    Архівувати вправу? Вона зникне з каталогу та більше не буде доступна для
                    додавання в нові тренування.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled={archiving} onClick={() => void archive()}>
                      {archiving ? 'Архівуємо…' : 'Так, архівувати'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={archiving}
                      onClick={() => {
                        setArchiveConfirmation(false);
                        setArchiveError(null);
                      }}
                    >
                      Ні, залишити
                    </Button>
                  </div>
                </div>
              )}
              {archiveError && (
                <div role="alert" className="space-y-2">
                  <p className="text-sm text-destructive">{archiveError}</p>
                  <Button type="button" variant="outline" disabled={archiving} onClick={retry}>
                    Оновити дані
                  </Button>
                </div>
              )}
            </section>
          )}

          {editing &&
            canManageCustomExercise(state.exercise, actor) &&
            (actor.role === 'ATHLETE' || actor.role === 'TRAINER') && (
              <EditExerciseForm
                exercise={state.exercise}
                role={actor.role}
                onSaved={(exercise) => {
                  setState({ kind: 'ready', exercise });
                  setEditing(false);
                }}
                onCancel={() => setEditing(false)}
                onReload={retry}
              />
            )}

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
