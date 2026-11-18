import type { ReactNode } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';

import { parseSidebarCollapsed, SIDEBAR_COOKIE_NAME } from '@/shared/lib/sidebar-preference';
import { parseThemePreference, THEME_COOKIE_NAME } from '@/shared/lib/theme-preference';
import { AthleteShell } from '@/widgets/athlete-shell/ui/athlete-shell';

/**
 * Visual shell only. Individual protected pages continue verifying the session
 * on the server; layouts can be cached by Next.js during client navigation.
 */
export default async function ProtectedLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [t, locale, cookieStore] = await Promise.all([
    getTranslations('web.navigation'),
    getLocale(),
    cookies(),
  ]);
  const preference = parseThemePreference(cookieStore.get(THEME_COOKIE_NAME)?.value);
  const initialCollapsed = parseSidebarCollapsed(cookieStore.get(SIDEBAR_COOKIE_NAME)?.value);

  return (
    <AthleteShell
      locale={locale}
      initialPreference={preference}
      initialCollapsed={initialCollapsed}
      navigationLabel={t('accountNav')}
      links={[
        { href: '/dashboard', label: t('dashboard') },
        { href: '/workouts', label: t('workouts') },
        { href: '/exercises', label: t('exercises') },
        { href: '/profile', label: t('profile') },
      ]}
    >
      {children}
    </AthleteShell>
  );
}
