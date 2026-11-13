import type { Metadata } from 'next';
import Link from 'next/link';

import { getPasswordResetToken } from '@/features/auth/lib/password-reset-flow';
import { ResetPasswordForm } from '@/features/auth/ui/reset-password-form';

export const metadata: Metadata = {
  title: 'Новий пароль | Gym Platform',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token: rawToken } = await searchParams;
  const token = getPasswordResetToken(rawToken);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-card-foreground">
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:underline">
          Gym Platform
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Створити новий пароль</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Введіть новий пароль, щоб відновити доступ до облікового запису.
        </p>
        <ResetPasswordForm token={token} />
      </div>
    </main>
  );
}
