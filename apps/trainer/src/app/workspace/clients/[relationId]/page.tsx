import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';

import type { Locale } from '@gym/i18n';

import { TrainerSignOutButton } from '@/features/auth/ui/trainer-sign-out-button';
import { verifyTrainerAccess } from '@/shared/api/server-capability';
import { loadTrainerClientProgress } from '@/shared/api/trainer-client-progress';
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
}: {
  params: Promise<{ relationId: string }>;
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
      {result.activeProgramAssignments === 0 && result.completedProgramWorkouts30d === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-muted-foreground">
          {t.clientProgressEmpty}
        </p>
      ) : null}
    </section>
  );
}
