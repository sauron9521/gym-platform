import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { BrandLogo } from '@gym/ui-web';

import { getVerificationToken } from '@/features/auth/lib/email-verification-flow';
import { VerifyEmailForm } from '@/features/auth/ui/verify-email-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.verification');
  return {
    title: `${t('title')} | OVRANTO`,
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const t = await getTranslations('web.verification');
  const { token: rawToken } = await searchParams;
  const token = getVerificationToken(rawToken);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-card-foreground">
        <Link
          href="/"
          className="inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <BrandLogo showTagline={false} />
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">{t('title')}</h1>
        {/* The token is stripped from history; do not refresh this page for locale switching. */}
        <VerifyEmailForm token={token} />
      </div>
    </main>
  );
}
