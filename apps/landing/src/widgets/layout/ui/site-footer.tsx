import Link from 'next/link';
import { defaultLocale, type Locale } from '@gym/i18n';
import { BrandLogo } from '@gym/ui-web';

import { getLandingNavigation } from '@/shared/lib/landing-navigation';
import { AnalyticsScript } from '@/widgets/analytics/ui/analytics-script';

export function SiteFooter({ locale = defaultLocale }: { locale?: Locale } = {}) {
  const { main, applications, productDirectoryLabel, shell } = getLandingNavigation(locale);
  return (
    <footer className="border-t border-border/70 bg-secondary/45">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link
            href="/"
            aria-label="OVRANTO"
            className="inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            <BrandLogo />
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-7 text-muted-foreground">{shell.summary}</p>
        </div>
        <nav aria-label={shell.sectionsNav}>
          <h2 className="text-sm font-semibold text-foreground">{shell.platform}</h2>
          <ul className="mt-4 space-y-3">
            {main.map(({ label, href }) => (
              <li key={href}>
                <Link
                  className="inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                  href={href}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={shell.applications}>
          <h2 className="text-sm font-semibold text-foreground">{productDirectoryLabel}</h2>
          <ul className="mt-4 space-y-3">
            <li>
              <Link
                className="inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                href="/apps"
              >
                {productDirectoryLabel}
              </Link>
            </li>
            {applications.map(({ label, href }) => (
              <li key={href}>
                <Link
                  className="inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                  href={href}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-border/70 px-6 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} OVRANTO · {shell.inDevelopment}
      </div>
      <AnalyticsScript />
    </footer>
  );
}
