'use client';

import { useRef } from 'react';
import Link from 'next/link';

import { defaultLocale, type Locale } from '@gym/i18n';
import { getLandingNavigation } from '@/shared/lib/landing-navigation';

export function MobileNavigation({ locale = defaultLocale }: { locale?: Locale } = {}) {
  const { main, productDirectoryLabel, shell } = getLandingNavigation(locale);
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);

  function closeMenu() {
    if (details.current) {
      details.current.open = false;
    }
  }

  return (
    <details
      ref={details}
      className="group relative lg:hidden"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          closeMenu();
          summary.current?.focus();
          event.stopPropagation();
        }
      }}
    >
      <summary
        ref={summary}
        className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ☰
        </span>
        {shell.menu}
      </summary>
      <nav
        aria-label={shell.mobileNav}
        className="absolute top-full right-0 mt-3 flex w-[min(17rem,calc(100vw-2rem))] flex-col gap-1 rounded-2xl border border-border bg-card p-2 shadow-xl shadow-foreground/10"
      >
        {main.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            onClick={closeMenu}
            className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary"
          >
            {label}
          </Link>
        ))}
        <Link
          href="/apps"
          onClick={closeMenu}
          className="rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          {productDirectoryLabel}
        </Link>
      </nav>
    </details>
  );
}
