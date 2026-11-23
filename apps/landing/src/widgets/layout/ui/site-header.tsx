import Link from 'next/link';
import { defaultLocale, type Locale } from '@gym/i18n';
import { BrandLogo } from '@gym/ui-web';

import { getLandingNavigation } from '@/shared/lib/landing-navigation';
import type { ThemePreference } from '@/shared/lib/theme-preference';
import { Button } from '@/shared/ui/button';
import { ThemeSwitcher } from '@/shared/ui/theme-switcher';
import { MobileNavigation } from './mobile-navigation';

export function SiteHeader({
  locale = defaultLocale,
  initialTheme = 'system',
}: { locale?: Locale; initialTheme?: ThemePreference } = {}) {
  const { main, productDirectoryLabel, shell } = getLandingNavigation(locale);
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6 lg:gap-6">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          aria-label={`OVRANTO — ${shell.homeAria}`}
        >
          <BrandLogo className="max-[440px]:gap-0 max-[440px]:[&>span]:hidden" />
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

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <ThemeSwitcher initialPreference={initialTheme} locale={locale} />
          <div className="hidden lg:block">
            <Button asChild size="touch" className="rounded-xl px-6">
              <Link href="/apps">{productDirectoryLabel}</Link>
            </Button>
          </div>
          <MobileNavigation locale={locale} />
        </div>
      </div>
    </header>
  );
}
