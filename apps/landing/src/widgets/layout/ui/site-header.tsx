import Link from 'next/link';

import { mainNavigation } from '@/shared/config/navigation';
import { Button } from '@/shared/ui/button';

export function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-6 px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-3 text-lg font-bold tracking-tight focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          aria-label="Gym Platform — головна сторінка"
        >
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-lg bg-primary text-xl font-black text-primary-foreground"
          >
            G
          </span>
          <span>Gym Platform</span>
        </Link>

        <nav aria-label="Основна навігація" className="hidden items-center gap-7 lg:flex">
          {mainNavigation.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:block">
          <Button asChild>
            <Link href="/apps">Застосунки</Link>
          </Button>
        </div>

        <details className="group relative lg:hidden">
          <summary
            className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
          >
            <span aria-hidden="true" className="text-lg leading-none">☰</span>
            Меню
          </summary>
          <nav
            aria-label="Мобільна навігація"
            className="absolute top-full right-0 mt-3 flex w-60 flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-xl"
          >
            {mainNavigation.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/apps"
              className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              Застосунки
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
