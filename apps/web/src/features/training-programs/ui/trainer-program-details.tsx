'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';
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
import { EditTrainingProgramDraftForm } from './edit-training-program-draft-form';
import { TrainingProgramWorkouts } from './training-program-workouts';

type DetailsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; program: TrainingProgramItem };

export function TrainerProgramDetails({ programId }: { programId: string }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DetailsState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    void webApi
      .GET('/training-programs/{programId}', {
        params: { path: { programId } },
      })
      .then(({ response, data }) => {
        if (!active) return;
        if (response.status === 401) {
          router.replace('/login');
          return;
        }
        if (response.status !== 200 || !data) {
          setState({ kind: 'error', message: getTrainingProgramDetailsError(response.status) });
          return;
        }
        setState({ kind: 'ready', program: data });
      })
      .catch(() => {
        if (active) setState({ kind: 'error', message: getTrainingProgramDetailsError() });
      });

    return () => {
      active = false;
    };
  }, [programId, attempt, router]);

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((value) => value + 1);
  }

  function onUpdated(version: TrainingProgramVersionItem) {
    setState((previous) => {
      if (previous.kind !== 'ready') return previous;
      return {
        kind: 'ready',
        program: {
          ...previous.program,
          versions: previous.program.versions.map((item) =>
            item.id === version.id ? version : item,
          ),
        },
      };
    });
  }

  const program = state.kind === 'ready' ? state.program : null;
  const latest = program ? sortProgramVersions(program.versions)[0] : undefined;

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
