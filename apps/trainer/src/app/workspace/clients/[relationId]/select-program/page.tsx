import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';

import type { Locale } from '@gym/i18n';

import { TrainerSignOutButton } from '@/features/auth/ui/trainer-sign-out-button';
import { TrainerAssignVersionButton } from '@/features/training-programs/ui/trainer-assign-version-button';
import { verifyTrainerAccess } from '@/shared/api/server-capability';
import { loadTrainerClientProgress } from '@/shared/api/trainer-client-progress';
import {
  loadTrainerProgramSelector,
  parseProgramChoicePage,
} from '@/shared/api/trainer-program-selector';
import { getTrainerCopy } from '@/shared/i18n/copy';

type Copy = ReturnType<typeof getTrainerCopy>;
type BlockedKind = 'unauthenticated' | 'forbidden' | 'not_found' | 'unavailable';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Choose client program | OVRANTO Trainer',
  robots: { index: false, follow: false },
};

function AccessNotice({ kind, t }: { kind: BlockedKind; t: Copy }) {
  const content = {
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
      title: t.trainerAccessUnavailable,
      description: t.trainerAccessUnavailableDescription,
    },
  }[kind];
  const login = kind === 'unauthenticated' || kind === 'forbidden';
  return (
    <section aria-labelledby="program-choice-blocked" className="max-w-2xl space-y-4">
      <h1 id="program-choice-blocked" className="text-3xl font-semibold">
        {content.title}
      </h1>
      <p className="text-muted-foreground">{content.description}</p>
      <Link
        href={login ? '/login' : '/workspace'}
        prefetch={false}
        className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {login ? t.loginLink : t.backToDashboard}
      </Link>
    </section>
  );
}

export default async function TrainerChooseClientProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ relationId: string }>;
  searchParams: Promise<{
    page?: string | string[];
    programId?: string | string[];
    versionId?: string | string[];
  }>;
}) {
  const t = getTrainerCopy((await getLocale()) as Locale);
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const access = await verifyTrainerAccess(cookieHeader);
  if (access.kind !== 'allowed') {
    return <AccessNotice kind={access.kind} t={t} />;
  }

  const { relationId } = await params;
  const client = await loadTrainerClientProgress(cookieHeader, relationId);
  if (client.kind !== 'ready') {
    return <AccessNotice kind={client.kind} t={t} />;
  }

  const query = await searchParams;
  const page = parseProgramChoicePage(query.page);
  const choices = await loadTrainerProgramSelector(
    cookieHeader,
    page,
    query.programId,
    query.versionId,
  );

  // Rejected/revoked authorization in any *later* upstream read suppresses
  // earlier client contact and program data, not just the affected widget.
  if (choices.kind === 'unauthenticated' || choices.kind === 'forbidden') {
    return <AccessNotice kind={choices.kind} t={t} />;
  }

  const clientPath = `/workspace/clients/${encodeURIComponent(relationId)}`;
  const choicePath = `${clientPath}/select-program`;
  const selectedProgramId =
    choices.kind === 'ready' && choices.selection.kind === 'ready'
      ? choices.selection.program.id
      : '';
  const selectedVersionId =
    choices.kind === 'ready' && choices.selection.kind === 'ready'
      ? choices.selection.selectedVersion?.id
      : undefined;
  return (
    <section aria-labelledby="program-choice-title" className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Link
            href={clientPath}
            prefetch={false}
            className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t.backToClientProgress}
          </Link>
          <h1 id="program-choice-title" className="text-3xl font-semibold sm:text-4xl">
            {t.programChoiceHeading}
          </h1>
          <p className="break-all text-muted-foreground">{client.clientEmail}</p>
          <p className="text-sm text-muted-foreground">{t.programChoiceDescription}</p>
        </div>
        <TrainerSignOutButton />
      </div>

      <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        {t.programChoiceReadOnly}
      </p>

      {choices.kind === 'unavailable' ? (
        <section role="alert" className="max-w-2xl space-y-3 rounded-2xl border border-border p-6">
          <h2 className="font-semibold">{t.programChoiceUnavailable}</h2>
          <p className="text-sm text-muted-foreground">{t.dashboardRetryDescription}</p>
          <Link
            href={choicePath}
            prefetch={false}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-medium hover:bg-muted"
          >
            {t.retry}
          </Link>
        </section>
      ) : (
        <>
          <section
            aria-labelledby="program-choices-title"
            className="rounded-2xl border border-border bg-card p-5 sm:p-7"
          >
            <h2 id="program-choices-title" className="text-xl font-semibold">
              {t.programChoicePublishedPrograms}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{t.programChoiceTitleHint}</p>

            {choices.total === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-border p-5 text-muted-foreground">
                {t.programChoiceNoPrograms}
              </p>
            ) : choices.programs.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-border p-5 text-muted-foreground">
                {t.programChoicePageEmpty}
              </p>
            ) : (
              <ul
                className="mt-4 divide-y divide-border"
                aria-label={t.programChoicePublishedPrograms}
              >
                {choices.programs.map((program) => {
                  const selected =
                    choices.selection.kind === 'ready' &&
                    choices.selection.program.id === program.id;
                  return (
                    <li
                      key={program.id}
                      className="flex min-w-0 flex-wrap items-center justify-between gap-4 py-4"
                    >
                      <span className="min-w-0 break-words font-medium">{program.title}</span>
                      <Link
                        href={`${choicePath}?page=${choices.page}&programId=${program.id}`}
                        prefetch={false}
                        aria-current={selected ? 'true' : undefined}
                        className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-border px-4 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {t.programChoiceViewVersions}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {choices.totalPages > 1 ? (
              <nav
                aria-label={t.programChoicePages}
                className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
              >
                <span className="text-sm text-muted-foreground">
                  {t.pageLabel} {choices.page} / {choices.totalPages}
                </span>
                <div className="flex gap-3">
                  {choices.page > 1 ? (
                    <Link
                      href={`${choicePath}?page=${choices.page - 1}`}
                      prefetch={false}
                      className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-medium hover:bg-muted"
                    >
                      {t.previousPage}
                    </Link>
                  ) : null}
                  {choices.page < choices.totalPages ? (
                    <Link
                      href={`${choicePath}?page=${choices.page + 1}`}
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

          {choices.selection.kind === 'not_found' ? (
            <p role="status" className="rounded-xl border border-border p-5 text-muted-foreground">
              {t.programChoiceNotFound}
            </p>
          ) : choices.selection.kind === 'unavailable' ? (
            <p role="alert" className="rounded-xl border border-border p-5 text-muted-foreground">
              {t.programChoiceVersionsUnavailable}
            </p>
          ) : choices.selection.kind === 'ready' ? (
            <section
              aria-labelledby="program-versions-title"
              className="rounded-2xl border border-border bg-card p-5 sm:p-7"
            >
              <h2 id="program-versions-title" className="text-xl font-semibold">
                {t.programChoicePublishedVersions}
              </h2>
              {choices.selection.versions.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-muted-foreground">
                  {t.programChoiceNoVersions}
                </p>
              ) : (
                <ul
                  className="mt-4 divide-y divide-border"
                  aria-label={t.programChoicePublishedVersions}
                >
                  {choices.selection.versions.map((version) => (
                    <li
                      key={version.id}
                      className="flex min-w-0 flex-wrap items-center justify-between gap-4 py-4"
                    >
                      <div className="min-w-0">
                        <p className="break-words font-medium">{version.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {t.clientAssignmentVersion} {version.version}
                        </p>
                      </div>
                      <Link
                        href={`${choicePath}?page=${choices.page}&programId=${selectedProgramId}&versionId=${version.id}`}
                        prefetch={false}
                        aria-current={selectedVersionId === version.id ? 'true' : undefined}
                        className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-border px-4 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {t.programChoiceSelectVersion}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {choices.selection.selectedVersion ? (
                <TrainerAssignVersionButton
                  relationId={relationId}
                  programId={choices.selection.program.id}
                  versionId={choices.selection.selectedVersion.id}
                  versionTitle={choices.selection.selectedVersion.title}
                  versionNumber={choices.selection.selectedVersion.version}
                  clientPath={clientPath}
                />
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
