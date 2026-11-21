import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';

import type { Locale } from '@gym/i18n';

import { TrainerSignOutButton } from '@/features/auth/ui/trainer-sign-out-button';
import { verifyTrainerAccess } from '@/shared/api/server-capability';
import { loadTrainerClients, parseTrainerClientsPage } from '@/shared/api/trainer-clients';
import { loadTrainerOverview } from '@/shared/api/trainer-overview';
import { loadTrainerRecentPrograms } from '@/shared/api/trainer-recent-programs';
import { getTrainerCopy } from '@/shared/i18n/copy';

type TrainerCopy = ReturnType<typeof getTrainerCopy>;
type BlockedKind = 'unauthenticated' | 'forbidden' | 'unavailable';

function WorkspaceAccessNotice({ kind, t }: { kind: BlockedKind; t: TrainerCopy }) {
  const messages = {
    unauthenticated: {
      title: t.signInRequired,
      description: t.signInRequiredDescription,
    },
    forbidden: {
      title: t.trainerAccessDenied,
      description: t.trainerAccessDeniedDescription,
    },
    unavailable: {
      title: t.trainerAccessUnavailable,
      description: t.trainerAccessUnavailableDescription,
    },
  };
  const { title, description } = messages[kind];
  return (
    <section aria-labelledby="workspace-access" className="max-w-2xl space-y-4">
      <h1 id="workspace-access" className="text-3xl font-semibold">
        {title}
      </h1>
      <p className="text-muted-foreground">{description}</p>
      <Link
        href={kind === 'unauthenticated' || kind === 'forbidden' ? '/login' : '/'}
        className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {kind === 'unauthenticated' || kind === 'forbidden' ? t.loginLink : t.returnHome}
      </Link>
    </section>
  );
}

function DashboardMetric({
  label,
  value,
  description,
  unavailable,
}: {
  label: string;
  value: number | null;
  description: string;
  unavailable: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6" aria-label={label}>
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      {value === null ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {unavailable}
        </p>
      ) : (
        <p className="mt-3 text-4xl font-bold text-primary tabular-nums">{value}</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{description}</p>
    </section>
  );
}

export const metadata: Metadata = {
  title: 'Dashboard | OVRANTO Trainer',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function TrainerWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ clientsPage?: string | string[] }>;
}) {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const access = await verifyTrainerAccess(cookieHeader);
  const t = getTrainerCopy((await getLocale()) as Locale);

  if (access.kind !== 'allowed') {
    return <WorkspaceAccessNotice kind={access.kind} t={t} />;
  }

  // Only after the fresh server-side grant check can we fetch private rows.
  const { clientsPage } = await searchParams;
  const page = parseTrainerClientsPage(clientsPage);
  const [result, overview, programs] = await Promise.all([
    loadTrainerClients(cookieHeader, page),
    loadTrainerOverview(cookieHeader),
    loadTrainerRecentPrograms(cookieHeader),
  ]);

  // A grant can be revoked between the initial capability check and either read.
  // Never show even successful private rows when one endpoint now denies access.
  if ([result.kind, overview.kind, programs.kind].includes('unauthenticated')) {
    return <WorkspaceAccessNotice kind="unauthenticated" t={t} />;
  }
  if ([result.kind, overview.kind, programs.kind].includes('forbidden')) {
    return <WorkspaceAccessNotice kind="forbidden" t={t} />;
  }

  return (
    <section aria-labelledby="workspace-title" className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-bold tracking-[0.1em] text-primary uppercase">
            {t.pageEyebrow}
          </p>
          <h1 id="workspace-title" className="text-3xl font-semibold sm:text-4xl">
            {t.dashboardTitle}
          </h1>
          <p className="text-muted-foreground">{t.dashboardDescription}</p>
        </div>
        <TrainerSignOutButton />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <DashboardMetric
          label={t.activeClients}
          value={overview.kind === 'ready' ? overview.activeClients : null}
          description={t.activeClientsDescription}
          unavailable={t.metricUnavailable}
        />
        <DashboardMetric
          label={t.programs}
          value={overview.kind === 'ready' ? overview.activeProgramAssignments : null}
          description={t.activeProgramAssignmentsDescription}
          unavailable={t.metricUnavailable}
        />
        <DashboardMetric
          label={t.progressTitle}
          value={overview.kind === 'ready' ? overview.completedProgramWorkouts30d : null}
          description={t.completedProgramWorkoutsDescription}
          unavailable={t.metricUnavailable}
        />
      </div>

      <section
        aria-labelledby="dashboard-programs-title"
        className="rounded-2xl border border-border bg-card p-5 sm:p-7"
      >
        <div className="mb-5 space-y-1">
          <h2 id="dashboard-programs-title" className="text-xl font-semibold">
            {t.recentProgramsHeading}
          </h2>
          <p className="text-sm text-muted-foreground">{t.recentProgramsDescription}</p>
        </div>
        {programs.kind !== 'ready' ? (
          <div role="alert" className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="font-medium">{t.programsUnavailable}</p>
            <Link
              href="/workspace"
              prefetch={false}
              className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t.retry}
            </Link>
          </div>
        ) : programs.programs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-muted-foreground">
            {t.programsEmpty}
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              {t.programsTotal}: <span className="tabular-nums">{programs.total}</span>
            </p>
            <ul className="divide-y divide-border" aria-label={t.recentProgramsHeading}>
              {programs.programs.map((program) => (
                <li
                  key={program.id}
                  className="flex min-w-0 items-center justify-between gap-3 py-3"
                >
                  <span className="min-w-0 truncate font-medium" title={program.title}>
                    {program.title}
                  </span>
                  <span className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                    {program.status === 'DRAFT'
                      ? t.programStatusDraft
                      : program.status === 'PUBLISHED'
                        ? t.programStatusPublished
                        : t.programStatusArchived}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section
        aria-labelledby="dashboard-clients-title"
        className="rounded-2xl border border-border bg-card p-5 sm:p-7"
      >
        <div className="mb-5 space-y-1">
          <h2 id="dashboard-clients-title" className="text-xl font-semibold">
            {t.clientsHeading}
          </h2>
          <p className="text-sm text-muted-foreground">{t.clientsDescription}</p>
        </div>

        {result.kind !== 'ready' ? (
          <div role="alert" className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
            <p className="font-medium">{t.dashboardUnavailable}</p>
            <p className="text-sm text-muted-foreground">{t.dashboardRetryDescription}</p>
            <Link
              href="/workspace"
              prefetch={false}
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2 font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t.retry}
            </Link>
          </div>
        ) : result.total === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-muted-foreground">
            {t.clientsEmpty}
          </p>
        ) : result.clients.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-muted-foreground">
            {t.clientsPageEmpty}
          </p>
        ) : (
          <ul className="divide-y divide-border" aria-label={t.clientsHeading}>
            {result.clients.map((client) => (
              <li key={client.id} className="flex min-w-0 items-center gap-4 py-4">
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary"
                >
                  {client.email.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium" title={client.email}>
                    {client.email}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.activeRelation}</p>
                </div>
                <Link
                  href={`/workspace/clients/${encodeURIComponent(client.id)}`}
                  prefetch={false}
                  className="ml-auto inline-flex min-h-11 shrink-0 items-center rounded-lg border border-border px-3 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t.clientProgressLink}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {result.kind === 'ready' && result.totalPages > 1 ? (
          <nav
            className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5"
            aria-label={t.clientsPagination}
          >
            <span className="text-sm text-muted-foreground">
              {t.pageLabel} {result.page} / {result.totalPages}
            </span>
            <div className="flex gap-3">
              {result.page > 1 ? (
                <Link
                  className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-medium hover:bg-muted"
                  href={`/workspace?clientsPage=${result.page - 1}`}
                  prefetch={false}
                >
                  {t.previousPage}
                </Link>
              ) : null}
              {result.page < result.totalPages ? (
                <Link
                  className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-medium hover:bg-muted"
                  href={`/workspace?clientsPage=${result.page + 1}`}
                  prefetch={false}
                >
                  {t.nextPage}
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </section>
    </section>
  );
}
