'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useRef, useState, type ReactNode } from 'react';

import { BrandLogo } from '@gym/ui-web';

import type { ThemePreference } from '@/shared/lib/theme-preference';
import { LocaleSwitcher } from '@/shared/ui/locale-switcher';
import { ThemeSwitcher } from '@/shared/ui/theme-switcher';

type NavigationLink = { href: string; label: string };

type AthleteShellProps = {
  children: ReactNode;
  links: NavigationLink[];
  navigationLabel: string;
  locale: string;
  initialPreference: ThemePreference;
};

export function isCurrentNavigationLink(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Shared presentation only: route pages own their individual server-side guards.
 * The small-screen navigation is a non-modal menu, not a focus-trapping dialog.
 */
export function AthleteShell({
  children,
  links,
  navigationLabel,
  locale,
  initialPreference,
}: AthleteShellProps) {
  const pathname = usePathname() ?? '';
  const [openedOnPath, setOpenedOnPath] = useState<string | null>(null);
  const menuOpen = openedOnPath === pathname;
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const english = locale === 'en';
  const openLabel = english ? 'Open navigation' : 'Відкрити навігацію';
  const closeLabel = english ? 'Close navigation' : 'Закрити навігацію';
  const homeLabel = english ? 'OVRANTO — home' : 'OVRANTO — головна';

  const navLinks = (onNavigate?: () => void) =>
    links.map((link) => {
      const active = isCurrentNavigationLink(pathname, link.href);

      return (
        <Link
          key={link.href}
          href={link.href}
          aria-current={active ? 'page' : undefined}
          onClick={onNavigate}
          className={
            active
              ? 'flex min-h-11 items-center rounded-lg border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary'
              : 'flex min-h-11 items-center rounded-lg border border-transparent px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none'
          }
        >
          {link.label}
        </Link>
      );
    });

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col overflow-y-auto border-r border-border bg-card px-4 py-6 lg:flex">
        <Link
          href="/"
          aria-label={homeLabel}
          className="mb-10 inline-flex rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <BrandLogo />
        </Link>
        <p className="mb-3 px-4 text-xs font-semibold tracking-wide text-muted-foreground">
          {navigationLabel}
        </p>
        <nav aria-label={navigationLabel} className="flex flex-col gap-1">
          {navLinks()}
        </nav>
      </aside>

      <div className="min-w-0">
        <header
          data-testid="athlete-shell-header"
          className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm"
          onKeyDown={(event) => {
            if (menuOpen && event.key === 'Escape') {
              setOpenedOnPath(null);
              menuButtonRef.current?.focus();
            }
          }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:justify-end lg:px-8">
            <Link
              href="/"
              aria-label={homeLabel}
              className="inline-flex min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring lg:hidden"
            >
              <BrandLogo showTagline={false} className="max-w-full" />
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              aria-controls={menuId}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? closeLabel : openLabel}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden"
              onClick={() => setOpenedOnPath(menuOpen ? null : pathname)}
            >
              <span aria-hidden="true" className="text-xl leading-none">
                {menuOpen ? '×' : '☰'}
              </span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border/60 px-4 py-2 lg:border-t-0 lg:px-8">
            <ThemeSwitcher initialPreference={initialPreference} locale={locale} />
            <LocaleSwitcher />
          </div>

          <nav
            id={menuId}
            aria-label={navigationLabel}
            hidden={!menuOpen}
            className="absolute inset-x-0 top-full max-h-[65dvh] overflow-y-auto border-b border-border bg-card p-3 shadow-sm lg:hidden"
          >
            <div className="flex flex-col gap-1">{navLinks(() => setOpenedOnPath(null))}</div>
          </nav>
        </header>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
