import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';

import type { Locale } from '@gym/i18n';

import { TrainerSignInForm } from '@/features/auth/ui/trainer-sign-in-form';
import { getTrainerCopy } from '@/shared/i18n/copy';

export const metadata: Metadata = {
  title: 'Sign in | OVRANTO Trainer',
  robots: { index: false, follow: false },
};

export default async function TrainerLoginPage() {
  const t = getTrainerCopy((await getLocale()) as Locale);

  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 sm:p-9">
      <h1 className="text-3xl font-semibold">{t.loginTitle}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{t.loginDescription}</p>
      <TrainerSignInForm />
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
      >
        {t.returnHome}
      </Link>
    </section>
  );
}
