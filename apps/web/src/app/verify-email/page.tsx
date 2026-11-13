import type { Metadata } from 'next';
import Link from 'next/link';

import { getVerificationToken } from '@/features/auth/lib/email-verification-flow';
import { VerifyEmailForm } from '@/features/auth/ui/verify-email-form';

export const metadata: Metadata = {
  title: 'Підтвердження email | Gym Platform',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token: rawToken } = await searchParams;
  const token = getVerificationToken(rawToken);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-card-foreground">
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:underline">
          Gym Platform
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Підтвердження електронної пошти</h1>
        <VerifyEmailForm token={token} />
      </div>
    </main>
  );
}
