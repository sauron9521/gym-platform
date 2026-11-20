import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';

import type { Locale } from '@gym/i18n';

import { verifyTrainerAccess } from '@/shared/api/server-capability';
import { getTrainerCopy } from '@/shared/i18n/copy';

export const metadata: Metadata = {
  title: 'Workspace | OVRANTO Trainer',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function TrainerWorkspacePage() {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const access = await verifyTrainerAccess(cookieHeader);
  const t = getTrainerCopy((await getLocale()) as Locale);

  if (access.kind !== 'allowed') {
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
    const { title, description } = messages[access.kind];

    return (
      <section aria-labelledby="workspace-access" className="max-w-2xl space-y-4">
        <h1 id="workspace-access" className="text-3xl font-semibold">
          {title}
        </h1>
        <p className="text-muted-foreground">{description}</p>
        <Link
          href={access.kind === 'unauthenticated' || access.kind === 'forbidden' ? '/login' : '/'}
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {access.kind === 'unauthenticated' || access.kind === 'forbidden'
            ? t.loginLink
            : t.returnHome}
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="workspace-title" className="max-w-3xl space-y-4">
      <p className="text-sm font-bold tracking-[0.1em] text-primary uppercase">{t.pageEyebrow}</p>
      <h1 id="workspace-title" className="text-3xl font-semibold">
        {t.workspaceTitle}
      </h1>
      <p className="text-muted-foreground">{t.workspaceDescription}</p>
    </section>
  );
}
