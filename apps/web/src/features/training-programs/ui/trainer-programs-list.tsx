'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import {
  trainerProgramsListQueryOptions,
  TrainerProgramListRequestError,
} from '../api/trainer-programs-list-query';
import { Button } from '@/shared/ui/button';
import {
  formatProgramDate,
  getProgramDisplayTitle,
  getProgramListError,
  getProgramStatusLabel,
  getProgramVersionStatusLabel,
  PROGRAM_STATUSES,
  sortProgramVersions,
  type ProgramStatusFilter,
  type TrainingProgramItem,
} from '../lib/training-programs-list';

type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; programs: TrainingProgramItem[]; total: number; pages: number };

export function TrainerProgramsList() {
  const t = useTranslations('web.trainerPrograms');
  const router = useRouter();
  const queryClient = useQueryClient();
  const redirecting = useRef(false);
  const [status, setStatus] = useState<ProgramStatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const query = useQuery(trainerProgramsListQueryOptions(status, page));
  const unauthenticated =
    query.error instanceof TrainerProgramListRequestError && query.error.status === 401;

  useEffect(() => {
    if (unauthenticated && !redirecting.current) {
      redirecting.current = true;
      queryClient.clear();
      router.replace('/login');
    }
  }, [unauthenticated, queryClient, router]);

  function changeStatus(next: ProgramStatusFilter) {
    setStatus(next);
    setPage(1);
  }

  function changePage(next: number) {
    setPage(next);
  }

  function retry() {
    void query.refetch();
  }

  let state: ListState;
  if (query.isPending || unauthenticated) {
    state = { kind: 'loading' };
  } else if (query.isError) {
    state = {
      kind: 'error',
      message:
        query.error instanceof TrainerProgramListRequestError
          ? query.error.message
          : getProgramListError(),
    };
  } else {
    state = {
      kind: 'ready',
      programs: query.data.programs,
      total: query.data.total,
      pages: query.data.pages,
    };
  }

  // Do not show cached trainer data after authentication fails.
  if (unauthenticated) return null;

  return (
    <main className="mx-auto max-w-5xl space-y-7 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('description')}
        </p>
      </header>

      <div>
        <Button asChild>
          <Link href="/trainer/programs/new">{t('create')}</Link>
        </Button>
      </div>

      <section className="space-y-2 rounded-xl border bg-card p-5" aria-label={t('filters')}>
        <label htmlFor="training-program-status" className="block text-sm font-medium">
          {t('status')}
        </label>
        <select
          id="training-program-status"
          value={status}
          onChange={(event) => changeStatus(event.target.value as ProgramStatusFilter)}
          className="h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
        >
          {PROGRAM_STATUSES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </section>

      {state.kind === 'loading' && (
        <p role="status" className="rounded-xl border bg-card p-6 text-muted-foreground">
          {t('loading')}
        </p>
      )}

      {state.kind === 'error' && (
        <section role="alert" className="space-y-3 rounded-xl border bg-card p-6">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button type="button" variant="outline" onClick={retry}>
            {t('retry')}
          </Button>
        </section>
      )}

      {state.kind === 'ready' && (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {t('total', { count: state.total })}
          </p>
          {state.programs.length === 0 ? (
            <section className="rounded-xl border bg-card p-6">
              <h2 className="font-semibold">{t('empty')}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('emptyHint')}
              </p>
            </section>
          ) : (
            <section aria-label={t('list')} className="grid gap-4">
              {state.programs.map((program) => (
                <article key={program.id} className="space-y-3 rounded-xl border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold">{getProgramDisplayTitle(program)}</h2>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                      {getProgramStatusLabel(program.status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('updated')} {formatProgramDate(program.updatedAt)} · {t('versions')}{' '}
                    {program.versions.length}
                  </p>
                  <div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/trainer/programs/${program.id}`}>{t('details')}</Link>
                    </Button>
                  </div>
                  {program.versions.length > 0 && (
                    <details className="space-y-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        {t('viewVersions')}
                      </summary>
                      <ul className="space-y-3 pt-3">
                        {sortProgramVersions(program.versions).map((version) => (
                          <li key={version.id} className="space-y-1 rounded-md border p-3 text-sm">
                            <div className="flex flex-wrap justify-between gap-2">
                              <span className="font-medium">
                                v{version.version} — {version.title}
                              </span>
                              <span className="text-muted-foreground">
                                {getProgramVersionStatusLabel(version.status)}
                              </span>
                            </div>
                            {version.description && (
                              <p className="whitespace-pre-wrap text-muted-foreground">
                                {version.description}
                              </p>
                            )}
                            {version.durationWeeks !== null && (
                              <p>{t('duration', { weeks: version.durationWeeks })}</p>
                            )}
                            {version.publishedAt && (
                              <p className="text-muted-foreground">
                                {t('published')} {formatProgramDate(version.publishedAt)}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </article>
              ))}
            </section>
          )}
          {state.pages > 1 && (
            <nav
              className="flex items-center justify-between gap-4"
              aria-label={t('pages')}
            >
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
              >
                {t('back')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('page', { page, total: state.pages })}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={page >= state.pages}
                onClick={() => changePage(page + 1)}
              >
                {t('next')}
              </Button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
