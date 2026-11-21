import Link from 'next/link';
import { defaultLocale, getMessages, type Locale } from '@gym/i18n';

import { getLandingNavigation } from '@/shared/lib/landing-navigation';
import { AnalyticsScript } from '@/widgets/analytics/ui/analytics-script';

export function SiteFooter({ locale = defaultLocale }: { locale?: Locale } = {}) {
  const { main, applications, shell } = getLandingNavigation(locale);
  const common = getMessages(locale).landing.common;
  return (
    <footer className="border-t border-border/70 bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-3">
        <div>
          <Link href="/" className="text-lg font-bold tracking-tight">
            Gym Platform
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-7 text-muted-foreground">{shell.summary}</p>
        </div>
        <nav aria-label={shell.sectionsNav}>
          <h2 className="text-sm font-semibold text-foreground">{shell.platform}</h2>
          <ul className="mt-4 space-y-3">
            {main.map(({ label, href }) => (
              <li key={href}>
                <Link className="text-sm text-muted-foreground hover:text-foreground" href={href}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={shell.applications}>
          <h2 className="text-sm font-semibold text-foreground">{shell.applications}</h2>
          <ul className="mt-4 space-y-3">
            <li>
              <Link className="text-sm text-muted-foreground hover:text-foreground" href="/apps">
                {common.allApplications}
              </Link>
            </li>
            {applications.map(({ label, href }) => (
              <li key={href}>
                <Link className="text-sm text-muted-foreground hover:text-foreground" href={href}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-border/70 px-6 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Gym Platform · {shell.inDevelopment}
      </div>
      <AnalyticsScript />
    </footer>
  );
}
