'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import {
  getProgramWorkoutsLoadError,
  sortProgramWorkouts,
  type ProgramVersionWithWorkouts,
} from '../lib/create-program-workout';
import { CreateProgramWorkoutForm } from './create-program-workout-form';

type WorkoutsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; version: ProgramVersionWithWorkouts };

export function TrainingProgramWorkouts({
  programId,
  versionId,
  durationWeeks,
  editable,
}: {
  programId: string;
  versionId: string;
  durationWeeks: number | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<WorkoutsState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    void webApi
      .GET('/training-programs/{programId}/versions/{versionId}', {
        params: { path: { programId, versionId } },
      })
      .then(({ response, data }) => {
        if (!active) return;
        if (response.status === 401) {
          router.replace('/login');
          return;
        }
        if (response.status !== 200 || !data) {
          setState({ kind: 'error', message: getProgramWorkoutsLoadError(response.status) });
          return;
        }
        setState({ kind: 'ready', version: data });
      })
      .catch(() => {
        if (active) setState({ kind: 'error', message: getProgramWorkoutsLoadError() });
      });

    return () => {
      active = false;
    };
  }, [programId, versionId, attempt, router]);

  const version = state.kind === 'ready' ? state.version : null;
  const workouts = version ? sortProgramWorkouts(version.workouts) : [];

  return (
    <section className="space-y-4" aria-label="Тренувальні дні">
      <h2 className="text-xl font-semibold">Тренувальні дні</h2>
      {state.kind === 'loading' && (
        <p role="status" className="rounded-xl border bg-card p-5 text-muted-foreground">
          Завантажуємо тренувальні дні…
        </p>
      )}
      {state.kind === 'error' && (
        <div role="alert" className="space-y-3 rounded-xl border bg-card p-5">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setState({ kind: 'loading' });
              setAttempt((value) => value + 1);
            }}
          >
            Спробувати ще раз
          </Button>
        </div>
      )}
      {version && (
        <>
          {workouts.length === 0 ? (
            <p role="status" className="rounded-xl border bg-card p-5 text-muted-foreground">
              Тренувальних днів поки немає.
            </p>
          ) : (
            <ol className="space-y-3">
              {workouts.map((workout) => (
                <li key={workout.id} className="space-y-2 rounded-xl border bg-card p-5">
                  <p className="text-sm text-muted-foreground">
                    Тиждень {workout.weekNumber} · День {workout.dayNumber}
                  </p>
                  <h3 className="text-lg font-semibold">{workout.title}</h3>
                  {workout.notes && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {workout.notes}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Вправ: {workout.exercises.length}
                  </p>
                </li>
              ))}
            </ol>
          )}
          {editable && version.status === 'DRAFT' && (
            <CreateProgramWorkoutForm
              programId={programId}
              versionId={versionId}
              durationWeeks={durationWeeks}
              onCreated={(updatedVersion) => setState({ kind: 'ready', version: updatedVersion })}
            />
          )}
        </>
      )}
    </section>
  );
}
