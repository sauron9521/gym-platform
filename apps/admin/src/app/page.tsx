import { BrandLogo, Card } from '@gym/ui-web';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';

import { readAdminSession } from '@/shared/api/admin-session';
import { readAdminHealth } from '@/shared/api/admin-health';
import { parseThemePreference, THEME_COOKIE_NAME } from '@/shared/lib/theme-preference';
import { LocaleSwitcher } from '@/shared/ui/locale-switcher';
import { ThemeSwitcher } from '@/shared/ui/theme-switcher';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const t = await getTranslations('admin');
  const cookie = (await headers()).get('cookie') ?? '';
  const session = await readAdminSession(cookie);

  if (session.kind !== 'admin') {
    const messages = {
      unauthenticated: t('unauthenticated'),
      forbidden: t('forbidden'),
      unavailable: t('unavailable'),
    };

    return (
      <main id="main-content" className="mx-auto max-w-3xl space-y-3 px-6 py-16" role="alert">
        <h1 className="text-2xl font-semibold">{t('unavailableTitle')}</h1>
        <p className="text-muted-foreground">{messages[session.kind]}</p>
      </main>
    );
  }

  // Both reads are intentionally *after* the server-side authorization check.
  const [readiness, cookieStore] = await Promise.all([readAdminHealth(), cookies()]);
  const theme = parseThemePreference(cookieStore.get(THEME_COOKIE_NAME)?.value);
  const planned = [
    t('navUsers'),
    t('navRoles'),
    t('navExercises'),
    t('navModeration'),
    t('navAudit'),
    t('navSettings'),
  ];

  const navigation = (
    <nav aria-label={t('navigationLabel')} className="space-y-1.5">
      <Link
        href="/"
        aria-current="page"
        className="flex min-h-11 items-center rounded-lg border border-primary/20 bg-primary/10 px-4 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t('navOverview')}
      </Link>
      {planned.map((label) => (
        <span
          key={label}
          aria-disabled="true"
          className="flex min-h-10 items-center justify-between gap-2 rounded-lg px-4 text-sm text-muted-foreground"
        >
          <span>{label}</span>
          <span className="text-xs">{t('navSoon')}</span>
        </span>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-border bg-card px-4 py-7 lg:flex lg:flex-col">
        <BrandLogo className="mb-3 px-2" showTagline={false} />
        <p className="mb-8 px-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {t('workspace')}
        </p>
        {navigation}
        <p className="mt-auto border-t border-border px-3 pt-6 text-xs leading-relaxed text-muted-foreground">
          {t('sidebarNotice')}
        </p>
      </aside>

      <div className="min-w-0">
        <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-4 sm:px-8">
          <div className="lg:hidden">
            <BrandLogo showTagline={false} />
          </div>
          <p className="hidden text-sm font-semibold text-muted-foreground lg:block">
            {t('workspace')}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <LocaleSwitcher />
            <ThemeSwitcher
              initialTheme={theme}
              labels={{
                title: t('themeLabel'),
                system: t('themeSystem'),
                light: t('themeLight'),
                dark: t('themeDark'),
              }}
            />
          </div>
        </header>

        <div className="border-b border-border bg-card px-5 py-3 lg:hidden">
          <details className="group">
            <summary className="w-fit cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              {t('navigationLabel')}
            </summary>
            <div className="pt-4">{navigation}</div>
          </details>
        </div>

        <main id="main-content" className="mx-auto max-w-6xl space-y-8 px-5 py-9 sm:px-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              {t('navOverview')}
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
            <p className="max-w-2xl text-muted-foreground">{t('accessConfirmed')}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="space-y-3 p-6">
              <h2 id="admin-readiness-heading" className="text-lg font-semibold">
                {t('readinessTitle')}
              </h2>
              <p
                role="status"
                className={`inline-flex rounded-lg px-3 py-2 text-sm font-medium ${readiness === 'healthy' ? 'bg-[var(--set-complete-background)] text-[var(--set-complete-foreground)]' : 'bg-[var(--set-error-background)] text-[var(--set-error-foreground)]'}`}
              >
                {readiness === 'healthy' ? t('readinessHealthy') : t('readinessDegraded')}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('readinessDisclaimer')}
              </p>
            </Card>

            <Card className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">{t('accessTitle')}</h2>
              <p className="text-sm font-medium text-primary">{t('accessStatus')}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('accessExplanation')}
              </p>
            </Card>
          </div>

          <section aria-labelledby="admin-modules-heading">
            <Card className="space-y-5 p-6">
              <div className="space-y-2">
                <h2 id="admin-modules-heading" className="text-xl font-semibold">
                  {t('plannedModulesTitle')}
                </h2>
                <p className="text-sm text-muted-foreground">{t('comingSoon')}</p>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {planned.map((label) => (
                  <li
                    key={label}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-4 py-3"
                  >
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground">{t('navSoon')}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">{t('unavailableFeatures')}</p>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}
