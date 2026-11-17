import Link from 'next/link';

import { mainNavigation } from '@/shared/config/navigation';
import { Button } from '@/shared/ui/button';
import { MobileNavigation } from './mobile-navigation';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
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

        <MobileNavigation />
      </div>
    </header>
  );
}
