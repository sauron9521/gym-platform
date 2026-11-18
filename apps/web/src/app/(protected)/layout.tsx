import Link from 'next/link';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { BrandLogo } from '@gym/ui-web';

import { LocaleSwitcher } from '@/shared/ui/locale-switcher';

/**
 * Shared visual shell only. Next.js may cache layouts during navigation.
 * Each private page MUST verify the session before rendering private UI.
 */
export default async function ProtectedLayout({ children }: Readonly<{ children: ReactNode }>) {
  const t = await getTranslations('web.navigation');
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            aria-label="OVRANTO — головна"
            className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-4">
            <nav aria-label={t('accountNav')}>
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
                {t('dashboard')}
              </Link>
              <Link href="/workouts" className="ml-5 text-sm text-muted-foreground hover:underline">
                {t('workouts')}
              </Link>
              <Link
                href="/exercises"
                className="ml-5 text-sm text-muted-foreground hover:underline"
              >
                {t('exercises')}
              </Link>
              <Link href="/profile" className="ml-5 text-sm text-muted-foreground hover:underline">
                {t('profile')}
              </Link>
            </nav>
            <LocaleSwitcher />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
