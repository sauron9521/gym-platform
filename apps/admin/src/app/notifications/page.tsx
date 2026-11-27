import Link from 'next/link';
import { BrandLogo } from '@gym/ui-web';
import { cookies, headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { AdminInboxProvider } from '@/features/notifications/model/inbox-session';
import { InboxBell } from '@/features/notifications/ui/admin-inbox-bell';
import { AdminInboxScreen } from '@/features/notifications/ui/admin-inbox-screen';
import { readAdminSession } from '@/shared/api/admin-session';
import { parseThemePreference, THEME_COOKIE_NAME } from '@/shared/lib/theme-preference';
import { LocaleSwitcher } from '@/shared/ui/locale-switcher';
import { ThemeSwitcher } from '@/shared/ui/theme-switcher';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export default async function AdminNotificationsPage() {
  const t = await getTranslations('admin');
  const session = await readAdminSession((await headers()).get('cookie') ?? '');
  if (session.kind !== 'admin') {
    return (
      <main id="main-content" role="alert" className="mx-auto max-w-3xl space-y-3 px-6 py-16">
        <h1 className="text-2xl font-semibold">{t('unavailableTitle')}</h1>
        <p className="text-muted-foreground">{t(session.kind)}</p>
      </main>
    );
  }
  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE_NAME)?.value);
  return (
    <AdminInboxProvider owner={session.id}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-5 py-4 sm:px-8">
        <Link prefetch={false} href="/" aria-label={t('navOverview')}>
          <BrandLogo showTagline={false} />
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <InboxBell />
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
      <AdminInboxScreen />
    </AdminInboxProvider>
  );
}
