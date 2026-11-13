import type { Metadata } from 'next';
import Link from 'next/link';

import { ForgotPasswordForm } from '@/features/auth/ui/forgot-password-form';

export const metadata: Metadata = {
  title: 'Відновлення пароля | Gym Platform',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-card-foreground">
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:underline">
          Gym Platform
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Забули пароль?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Вкажіть пошту облікового запису, і ми спробуємо надіслати інструкції.
        </p>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
