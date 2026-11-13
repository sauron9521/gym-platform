import type { Metadata } from 'next';
import Link from 'next/link';

import { ResendVerificationForm } from '@/features/auth/ui/resend-verification-form';

export const metadata: Metadata = {
  title: 'Повторне надсилання листа | Gym Platform',
  robots: { index: false, follow: false },
};

export default function ResendVerificationPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-card-foreground">
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:underline">
          Gym Platform
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Повторне надсилання листа</h1>
        <ResendVerificationForm />
      </div>
    </main>
  );
}
