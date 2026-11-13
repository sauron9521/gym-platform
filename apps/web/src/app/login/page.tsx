import type { Metadata } from 'next';
import Link from 'next/link';

import { SignInForm } from '@/features/auth/ui/sign-in-form';

export const metadata: Metadata = {
  title: 'Вхід | Gym Platform',
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-card-foreground">
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:underline">
          Gym Platform
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Вхід у кабінет</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Увійдіть за допомогою електронної пошти та пароля.
        </p>
        <SignInForm />
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Потрібно підтвердити адресу?{' '}
          <Link href="/verify-email/resend" className="font-medium text-foreground hover:underline">
            Надіслати лист ще раз
          </Link>
        </p>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Ще немає облікового запису?{' '}
          <Link href="/register" className="font-medium text-foreground hover:underline">
            Зареєструватися
          </Link>
        </p>
      </div>
    </main>
  );
}
