import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { BrandLogo } from '@gym/ui-web';

import { ResendVerificationForm } from '@/features/auth/ui/resend-verification-form';
import { LocaleSwitcher } from '@/shared/ui/locale-switcher';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.verification');
  return {
    title: `${t('resendTitle')} | OVRANTO`,
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default async function ResendVerificationPage() {
  const t = await getTranslations('web.verification');
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-card-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <BrandLogo showTagline={false} />
          </Link>
          <LocaleSwitcher />
        </div>
        <h1 className="mt-6 text-3xl font-semibold">{t('resendTitle')}</h1>
        <ResendVerificationForm />
      </div>
    </main>
  );
}
