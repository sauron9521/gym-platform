import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { BrandLogo } from '@gym/ui-web';

import { SignUpForm } from '@/features/auth/ui/sign-up-form';
import { LocaleSwitcher } from '@/shared/ui/locale-switcher';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.register');
  return { title: `${t('title')} | OVRANTO` };
}

export default async function RegisterPage() {
  const t = await getTranslations('web.register');
  const auth = await getTranslations('web.authFields');

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-card-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <BrandLogo showTagline={false} />
          </Link>
          <LocaleSwitcher />
        </div>
        <h1 className="mt-6 text-3xl font-semibold">{t('title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('description')}</p>
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
