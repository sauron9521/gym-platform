import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { ForgotPasswordForm } from '@/features/auth/ui/forgot-password-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.recovery');
  return {
    title: `${t('forgotTitle')} | Gym Platform`,
    robots: { index: false, follow: false },
  };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations('web.recovery');
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-card-foreground">
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:underline">
          Gym Platform
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">{t('forgotTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('forgotDescription')}</p>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
