'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import {
  trainingProgramVersionQueryOptions,
  TrainingProgramVersionRequestError,
} from '../api/training-program-version-query';
import { Button } from '@/shared/ui/button';
import {
  getProgramWorkoutsLoadError,
  sortProgramWorkouts,
  type ProgramVersionWithWorkouts,
} from '../lib/create-program-workout';
import { trainingProgramQueryKeys } from '../lib/training-program-query-keys';
import { CreateProgramWorkoutForm } from './create-program-workout-form';
import { ProgramWorkoutItem } from './program-workout-item';

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
  const queryClient = useQueryClient();
  const redirecting = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const query = useQuery(trainingProgramVersionQueryOptions(programId, versionId));
  const unauthenticated =
    query.error instanceof TrainingProgramVersionRequestError && query.error.status === 401;

  useEffect(() => {
    if (unauthenticated && !redirecting.current) {
      redirecting.current = true;
      queryClient.clear();
      router.replace('/login');
    }
  }, [unauthenticated, queryClient, router]);

  function retry() {
    void query.refetch();
  }

  function updateVersion(updatedVersion: ProgramVersionWithWorkouts, message: string | null) {
    queryClient.setQueryData(
      trainingProgramQueryKeys.version(programId, versionId),
      updatedVersion,
    );
    setNotice(message);
  }

  let state: WorkoutsState;
  if (query.isPending || unauthenticated) {
    state = { kind: 'loading' };
  } else if (query.isError) {
    state = {
      kind: 'error',
      message:
        query.error instanceof TrainingProgramVersionRequestError
          ? query.error.message
          : getProgramWorkoutsLoadError(),
    };
  } else {
    state = { kind: 'ready', version: query.data };
  }

  const version = state.kind === 'ready' ? state.version : null;
  const workouts = version ? sortProgramWorkouts(version.workouts) : [];

  // Prevent showing cached trainer-only workouts after a failed authentication check.
  if (unauthenticated) return null;

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
          <Button type="button" variant="outline" onClick={retry}>
            Спробувати ще раз
          </Button>
        </div>
      )}
      {version && (
        <>
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
          {workouts.length === 0 ? (
            <p role="status" className="rounded-xl border bg-card p-5 text-muted-foreground">
              Тренувальних днів поки немає.
            </p>
          ) : (
            <ol className="space-y-3">
              {workouts.map((workout) => (
                <ProgramWorkoutItem
                  key={workout.id}
                  programId={programId}
                  versionId={versionId}
                  workout={workout}
                  durationWeeks={durationWeeks}
                  editable={editable && version.status === 'DRAFT'}
                  onChanged={(updatedVersion, message) => {
                    updateVersion(updatedVersion, message);
                  }}
                />
              ))}
            </ol>
          )}
          {editable && version.status === 'DRAFT' && (
            <CreateProgramWorkoutForm
              programId={programId}
              versionId={versionId}
              durationWeeks={durationWeeks}
              onCreated={(updatedVersion) => {
                updateVersion(updatedVersion, null);
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
