import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { getPasswordResetToken } from '@/features/auth/lib/password-reset-flow';
import { ResetPasswordForm } from '@/features/auth/ui/reset-password-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.recovery');
  return {
  title: `${t('resetTitle')} | Gym Platform`,
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
  };
}

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const t = await getTranslations('web.recovery');
  const { token: rawToken } = await searchParams;
  const token = getPasswordResetToken(rawToken);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-card-foreground">
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:underline">
          Gym Platform
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">{t('resetTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('resetDescription')}
        </p>
        <ResetPasswordForm token={token} />
      </div>
    </main>
  );
}
