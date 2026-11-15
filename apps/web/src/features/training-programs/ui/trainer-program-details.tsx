'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  trainerProgramDetailsQueryOptions,
  TrainerProgramDetailsRequestError,
} from '../api/trainer-program-details-query';
import { Button } from '@/shared/ui/button';
import {
  formatProgramDate,
  getProgramDisplayTitle,
  getProgramStatusLabel,
  getProgramVersionStatusLabel,
  sortProgramVersions,
  type TrainingProgramItem,
  type TrainingProgramVersionItem,
} from '../lib/training-programs-list';
import { getTrainingProgramDetailsError } from '../lib/edit-training-program-draft';
import { trainingProgramQueryKeys } from '../lib/training-program-query-keys';
import { EditTrainingProgramDraftForm } from './edit-training-program-draft-form';
import { TrainingProgramWorkouts } from './training-program-workouts';

type DetailsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; program: TrainingProgramItem };

export function TrainerProgramDetails({ programId }: { programId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const redirecting = useRef(false);
  const query = useQuery(trainerProgramDetailsQueryOptions(programId));
  const unauthenticated =
    query.error instanceof TrainerProgramDetailsRequestError && query.error.status === 401;

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

  function onUpdated(version: TrainingProgramVersionItem) {
    queryClient.setQueryData<TrainingProgramItem>(
      trainingProgramQueryKeys.detail(programId),
      (current) =>
        current
          ? {
              ...current,
              versions: current.versions.map((item) => (item.id === version.id ? version : item)),
            }
          : current,
    );
  }

  let state: DetailsState;
  if (query.isPending || unauthenticated) {
    state = { kind: 'loading' };
  } else if (query.isError) {
    state = {
      kind: 'error',
      message:
        query.error instanceof TrainerProgramDetailsRequestError
          ? query.error.message
          : getTrainingProgramDetailsError(),
    };
  } else {
    state = { kind: 'ready', program: query.data };
  }

  const program = state.kind === 'ready' ? state.program : null;
  const latest = program ? sortProgramVersions(program.versions)[0] : undefined;

  // Never render cached private data after the server returns 401.
  if (unauthenticated) return null;

  return (
    <main className="mx-auto max-w-4xl space-y-7 px-6 py-12">
      <Link href="/trainer/programs" className="text-sm text-muted-foreground hover:underline">
        ← До тренувальних програм
      </Link>

      {state.kind === 'loading' && (
        <p role="status" className="rounded-xl border bg-card p-6 text-muted-foreground">
          Завантажуємо програму…
        </p>
      )}
      {state.kind === 'error' && (
        <section role="alert" className="space-y-3 rounded-xl border bg-card p-6">
          <h1 className="text-xl font-semibold">Не вдалося відкрити програму</h1>
          <p className="text-sm text-destructive">{state.message}</p>
          <Button type="button" variant="outline" onClick={retry}>
            Спробувати ще раз
          </Button>
        </section>
      )}
      {program && (
        <>
          <header className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Кабінет тренера</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {getProgramDisplayTitle(program)}
            </h1>
            <p className="text-sm text-muted-foreground">
              Статус програми: {getProgramStatusLabel(program.status)}
            </p>
            <p className="text-sm text-muted-foreground">
              Створено: {formatProgramDate(program.createdAt)} · Оновлено:{' '}
              {formatProgramDate(program.updatedAt)}
            </p>
          </header>

          {latest ? (
            <section
              className="space-y-3 rounded-xl border bg-card p-5"
              aria-label="Остання версія"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <h2 className="text-xl font-semibold">
                  v{latest.version} — {latest.title}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {getProgramVersionStatusLabel(latest.status)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {latest.description || 'Опис не вказано'}
              </p>
              <p className="text-sm">
                Тривалість:{' '}
                {latest.durationWeeks === null ? 'Не вказано' : `${latest.durationWeeks} тиж.`}
              </p>
              {latest.publishedAt && (
                <p className="text-sm text-muted-foreground">
                  Опубліковано: {formatProgramDate(latest.publishedAt)}
                </p>
              )}
            </section>
          ) : (
            <p role="status" className="rounded-xl border bg-card p-5 text-muted-foreground">
              Для цієї програми немає доступної версії.
            </p>
          )}

          {latest?.status === 'DRAFT' && program.status !== 'ARCHIVED' ? (
            <EditTrainingProgramDraftForm
              key={latest.id}
              programId={program.id}
              version={latest}
              onUpdated={onUpdated}
            />
          ) : (
            <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
              Редагування недоступне: можна змінювати лише активні чернетки.
            </p>
          )}

          {latest && (
            <TrainingProgramWorkouts
              key={latest.id}
              programId={program.id}
              versionId={latest.id}
              durationWeeks={latest.durationWeeks}
              editable={latest.status === 'DRAFT' && program.status !== 'ARCHIVED'}
            />
          )}
        </>
      )}
    </main>
  );
}
