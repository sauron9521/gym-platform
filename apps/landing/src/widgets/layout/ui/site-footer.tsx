import Link from 'next/link';

import { applicationNavigation, mainNavigation } from '@/shared/config/navigation';
import { AnalyticsScript } from '@/widgets/analytics/ui/analytics-script';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-3">
        <div>
          <Link href="/" className="text-lg font-bold tracking-tight">
            Gym Platform
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-7 text-muted-foreground">
            Єдина екосистема для спортсменів і тренерів. Платформа розвивається.
          </p>
        </div>
        <nav aria-label="Розділи сайту">
          <h2 className="text-sm font-semibold text-foreground">Платформа</h2>
          <ul className="mt-4 space-y-3">
            {mainNavigation.map(({ label, href }) => (
              <li key={href}>
                <Link className="text-sm text-muted-foreground hover:text-foreground" href={href}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Застосунки">
          <h2 className="text-sm font-semibold text-foreground">Застосунки</h2>
          <ul className="mt-4 space-y-3">
            <li>
              <Link className="text-sm text-muted-foreground hover:text-foreground" href="/apps">
                Усі застосунки
              </Link>
            </li>
            {applicationNavigation.map(({ label, href }) => (
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
        © {new Date().getFullYear()} Gym Platform · У розробці
      </div>
      <AnalyticsScript />
    </footer>
  );
}
