import type { Metadata } from 'next';
import Link from 'next/link';

import { SignUpForm } from '@/features/auth/ui/sign-up-form';

export const metadata: Metadata = {
  title: 'Реєстрація | Gym Platform',
};

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-card-foreground">
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:underline">
          Gym Platform
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Створити обліковий запис</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Зареєструйтеся, щоб зберігати свої тренування та програми.
        </p>
        <SignUpForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Уже є обліковий запис?{' '}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Увійти
          </Link>
        </p>
      </div>
    </main>
  );
}
