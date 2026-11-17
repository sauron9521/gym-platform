import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { SignUpForm } from '@/features/auth/ui/sign-up-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.register');
  return { title: `${t('title')} | Gym Platform` };
}

export default async function RegisterPage() {
  const t = await getTranslations('web.register');
  const auth = await getTranslations('web.authFields');
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-card-foreground">
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:underline">
          Gym Platform
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">{t('title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('description')}
        </p>
        <SignUpForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t('existing')}{' '}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            {auth('signIn')}
          </Link>
        </p>
      </div>
    </main>
  );
}
