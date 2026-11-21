'use client';

import { useRef } from 'react';
import Link from 'next/link';

import { defaultLocale, type Locale } from '@gym/i18n';
import { getLandingNavigation } from '@/shared/lib/landing-navigation';

export function MobileNavigation({ locale = defaultLocale }: { locale?: Locale } = {}) {
  const { main, nav, shell } = getLandingNavigation(locale);
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
        className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ☰
        </span>
        {shell.menu}
      </summary>
      <nav
        aria-label={shell.mobileNav}
        className="absolute top-full right-0 mt-3 flex w-60 flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-xl"
      >
        {main.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            onClick={closeMenu}
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
          >
            {label}
          </Link>
        ))}
        <Link
          href="/apps"
          onClick={closeMenu}
          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          {nav.apps}
        </Link>
      </nav>
    </details>
  );
}
