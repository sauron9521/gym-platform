import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';

import type { Locale } from '@gym/i18n';

import { TrainerSignOutButton } from '@/features/auth/ui/trainer-sign-out-button';
import { verifyTrainerAccess } from '@/shared/api/server-capability';
import { loadTrainerClientProgress } from '@/shared/api/trainer-client-progress';
import {
  loadTrainerClientAssignments,
  parseClientAssignmentsPage,
} from '@/shared/api/trainer-client-assignments';
import { getTrainerCopy } from '@/shared/i18n/copy';

type TrainerCopy = ReturnType<typeof getTrainerCopy>;
type BlockedKind = 'unauthenticated' | 'forbidden' | 'not_found' | 'unavailable';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Client progress | OVRANTO Trainer',
  robots: { index: false, follow: false },
};

function AccessNotice({ kind, t }: { kind: BlockedKind; t: TrainerCopy }) {
  const messages = {
    unauthenticated: {
      title: t.signInRequired,
      description: t.signInRequiredDescription,
    },
    forbidden: {
      title: t.trainerAccessDenied,
      description: t.trainerAccessDeniedDescription,
    },
    not_found: {
      title: t.clientProgressNotFound,
      description: t.clientProgressNotFoundDescription,
    },
    unavailable: {
      title: t.clientProgressUnavailable,
      description: t.dashboardRetryDescription,
    },
  };
  const blocked = messages[kind];
  const requiresLogin = kind === 'unauthenticated' || kind === 'forbidden';
  return (
    <section aria-labelledby="client-progress-blocked" className="max-w-2xl space-y-4">
      <h1 id="client-progress-blocked" className="text-3xl font-semibold">
        {blocked.title}
      </h1>
      <p className="text-muted-foreground">{blocked.description}</p>
      <Link
        href={requiresLogin ? '/login' : '/workspace'}
        prefetch={false}
        className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {requiresLogin ? t.loginLink : t.backToDashboard}
      </Link>
    </section>
  );
}

export default async function TrainerClientProgressPage({
  params,
  searchParams,
}: {
  params: Promise<{ relationId: string }>;
  searchParams: Promise<{ assignmentsPage?: string | string[] }>;
}) {
  const t = getTrainerCopy((await getLocale()) as Locale);
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const access = await verifyTrainerAccess(cookieHeader);

  if (access.kind !== 'allowed') {
    return (
      <AccessNotice kind={access.kind === 'unavailable' ? 'unavailable' : access.kind} t={t} />
    );
  }

  const { relationId } = await params;
  const result = await loadTrainerClientProgress(cookieHeader, relationId);

  if (result.kind !== 'ready') {
    return <AccessNotice kind={result.kind} t={t} />;
  }

  const { assignmentsPage } = await searchParams;
  const pageNumber = parseClientAssignmentsPage(assignmentsPage);
  const assignments = await loadTrainerClientAssignments(cookieHeader, relationId, pageNumber);

  // Live revocation/relationship termination between progress and the list
  // invalidates all previously loaded private data, including client email.
  if (
    assignments.kind === 'unauthenticated' ||
    assignments.kind === 'forbidden' ||
    assignments.kind === 'not_found'
  ) {
    return <AccessNotice kind={assignments.kind} t={t} />;
  }

  return (
    <section aria-labelledby="client-progress-title" className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 space-y-3">
          <Link
            href="/workspace"
            prefetch={false}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t.backToDashboard}
          </Link>
          <p className="text-sm font-bold tracking-[0.1em] text-primary uppercase">
            {t.pageEyebrow}
          </p>
          <h1 id="client-progress-title" className="text-3xl font-semibold sm:text-4xl">
            {t.clientProgressTitle}
          </h1>
          <p className="break-all text-muted-foreground">{result.clientEmail}</p>
          <p className="text-sm text-muted-foreground">{t.clientProgressDescription}</p>
        </div>
        <TrainerSignOutButton />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section
          aria-label={t.clientActiveAssignments}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t.clientActiveAssignments}
          </h2>
          <p className="mt-3 text-4xl font-bold text-primary tabular-nums">
            {result.activeProgramAssignments}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {t.clientActiveAssignmentsDescription}
          </p>
        </section>
        <section
          aria-label={t.clientCompletedWorkouts}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t.clientCompletedWorkouts}
          </h2>
          <p className="mt-3 text-4xl font-bold text-primary tabular-nums">
            {result.completedProgramWorkouts30d}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {t.completedProgramWorkoutsDescription}
          </p>
        </section>
      </div>
      <section
        aria-labelledby="client-assignments-title"
        className="rounded-2xl border border-border bg-card p-5 sm:p-7"
      >
        <div className="mb-5 space-y-1">
          <h2 id="client-assignments-title" className="text-xl font-semibold">
            {t.clientAssignmentsHeading}
          </h2>
          <p className="text-sm text-muted-foreground">{t.clientAssignmentsDescription}</p>
        </div>

        {assignments.kind !== 'ready' ? (
          <div role="alert" className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
            <p className="font-medium">{t.clientAssignmentsUnavailable}</p>
            <Link
              href={`/workspace/clients/${encodeURIComponent(relationId)}?assignmentsPage=${pageNumber}`}
              prefetch={false}
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t.retry}
            </Link>
          </div>
        ) : assignments.total === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-muted-foreground">
            {t.clientAssignmentsEmpty}
          </p>
        ) : assignments.assignments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-muted-foreground">
            {t.clientAssignmentsPageEmpty}
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              {t.clientAssignmentsTotal}: <span className="tabular-nums">{assignments.total}</span>
            </p>
            <ul className="divide-y divide-border" aria-label={t.clientAssignmentsHeading}>
              {assignments.assignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium" title={assignment.title}>
                      {assignment.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.clientAssignmentVersion} {assignment.version}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                    {assignment.status === 'ACTIVE'
                      ? t.clientAssignmentActive
                      : assignment.status === 'COMPLETED'
                        ? t.clientAssignmentCompleted
                        : assignment.status === 'CANCELLED'
                          ? t.clientAssignmentCancelled
                          : t.clientAssignmentTerminated}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {assignments.kind === 'ready' && assignments.totalPages > 1 ? (
          <nav
            className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5"
            aria-label={t.clientAssignmentsPagination}
          >
            <span className="text-sm text-muted-foreground">
              {t.pageLabel} {assignments.page} / {assignments.totalPages}
            </span>
            <div className="flex gap-3">
              {assignments.page > 1 ? (
                <Link
                  href={`/workspace/clients/${encodeURIComponent(relationId)}?assignmentsPage=${assignments.page - 1}`}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-medium hover:bg-muted"
                >
                  {t.previousPage}
                </Link>
              ) : null}
              {assignments.page < assignments.totalPages ? (
                <Link
                  href={`/workspace/clients/${encodeURIComponent(relationId)}?assignmentsPage=${assignments.page + 1}`}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-medium hover:bg-muted"
                >
                  {t.nextPage}
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </section>

      {result.activeProgramAssignments === 0 && result.completedProgramWorkouts30d === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-muted-foreground">
          {t.clientProgressEmpty}
        </p>
      ) : null}
    </section>
  );
}
