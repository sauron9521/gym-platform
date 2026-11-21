'use client';

import { BrandLogo } from '@gym/ui-web';
import type { Locale } from '@gym/i18n';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { getTrainerCopy } from '@/shared/i18n/copy';
import type { ThemePreference } from '@/shared/lib/theme-preference';
import { Preferences } from '@/shared/ui/preferences';

export function TrainerShell({
  children,
  locale,
  initialTheme,
}: {
  children: ReactNode;
  locale: Locale;
  initialTheme: ThemePreference;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const t = getTrainerCopy(locale);

  const navigation = (
    <nav aria-label={t.navigation} className="flex flex-col gap-2">
      <Link
        href="/workspace"
        aria-current={pathname === '/workspace' ? 'page' : undefined}
        onClick={() => setMenuOpen(false)}
        className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t.overview}
      </Link>
      {([t.athletes, t.programs, t.builder] as const).map((label) => (
        <span
          key={label}
          aria-disabled="true"
          className="flex items-center justify-between gap-2 rounded-lg border border-transparent px-4 py-3 text-muted-foreground"
        >
          {label}
          <span className="text-xs">{t.comingSoon}</span>
        </span>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-border bg-card p-5 lg:flex lg:min-h-screen lg:flex-col">
        <Link
          href="/"
          aria-label="OVRANTO"
          className="mb-10 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <BrandLogo />
        </Link>
        {navigation}
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="trainer-mobile-navigation"
              aria-label={menuOpen ? t.menuClose : t.menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
              className="min-h-11 rounded-lg border border-border px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
            <Link href="/" aria-label="OVRANTO" className="rounded-lg focus-visible:outline-2">
              <BrandLogo showTagline={false} />
            </Link>
          </div>
          <p className="hidden text-sm font-semibold text-muted-foreground lg:block">
            {t.pageEyebrow}
          </p>
          <Preferences locale={locale} initialTheme={initialTheme} />
        </header>
        <div
          id="trainer-mobile-navigation"
          className={menuOpen ? 'border-b border-border bg-card px-5 py-4 lg:hidden' : 'hidden'}
        >
          {navigation}
        </div>
        <main id="main-content" className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
