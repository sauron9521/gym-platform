import Link from 'next/link';
import { defaultLocale, type Locale } from '@gym/i18n';
import { BrandLogo } from '@gym/ui-web';

import { getLandingNavigation } from '@/shared/lib/landing-navigation';
import { Button } from '@/shared/ui/button';
import { MobileNavigation } from './mobile-navigation';

export function SiteHeader({ locale = defaultLocale }: { locale?: Locale } = {}) {
  const { main, nav, shell } = getLandingNavigation(locale);
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-6 lg:gap-8">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          aria-label={`OVRANTO — ${shell.homeAria}`}
        >
          <BrandLogo />
        </Link>

        <nav aria-label={shell.mainNav} className="hidden items-center gap-7 lg:flex">
          {main.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-semibold text-muted-foreground transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:block">
          <Button asChild size="touch" className="rounded-xl px-6">
            <Link href="/apps">{nav.apps}</Link>
          </Button>
        </div>

        <MobileNavigation locale={locale} />
      </div>
    </header>
  );
}
