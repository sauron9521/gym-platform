import { BrandLogo, Card } from '@gym/ui-web';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';

import { UsersTable, type DirectoryCopy } from '@/features/users/ui/users-table';
import { readAdminSession } from '@/shared/api/admin-session';
import {
  parseDirectoryFilters,
  readAdminDirectory,
  type DirectoryFilters,
  type DirectoryResult,
} from '@/shared/api/admin-directory';
import { parseThemePreference, THEME_COOKIE_NAME } from '@/shared/lib/theme-preference';
import { LocaleSwitcher } from '@/shared/ui/locale-switcher';
import { ThemeSwitcher } from '@/shared/ui/theme-switcher';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;
const DEFAULT_FILTERS: DirectoryFilters = { page: 1, search: '', role: '' };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
} = {}) {
  const [admin, t, locale] = await Promise.all([
    getTranslations('admin'),
    getTranslations('admin.users'),
    getLocale(),
  ]);
  const cookie = (await headers()).get('cookie') ?? '';
  const session = await readAdminSession(cookie);

  if (session.kind !== 'admin') {
    const messages = {
      unauthenticated: admin('unauthenticated'),
      forbidden: admin('forbidden'),
      unavailable: admin('unavailable'),
    };
    return (
      <main id="main-content" className="mx-auto max-w-3xl space-y-3 px-6 py-16" role="alert">
        <h1 className="text-2xl font-semibold">{admin('unavailableTitle')}</h1>
        <p className="text-muted-foreground">{messages[session.kind]}</p>
      </main>
    );
  }

  // Read the authenticated API only after verifying the Admin session, never
  // trust the presence of a cookie or user-controlled query parameters alone.
  const parsed = parseDirectoryFilters((await searchParams) ?? {});
  const filters = parsed.kind === 'valid' ? parsed.filters : DEFAULT_FILTERS;
  const result: DirectoryResult =
    parsed.kind === 'valid' ? await readAdminDirectory(cookie, filters) : { kind: 'invalid' };

  const cookieStore = await cookies();
  const theme = parseThemePreference(cookieStore.get(THEME_COOKIE_NAME)?.value);

  const copy: DirectoryCopy = {
    search: t('search'),
    allRoles: t('allRoles'),
    email: t('email'),
    role: t('role'),
    status: t('status'),
    joined: t('joined'),
    athlete: t('athlete'),
    trainer: t('trainer'),
    admin: t('admin'),
    active: t('active'),
    suspended: t('suspended'),
    unavailableTitle: t('unavailableTitle'),
    unavailableDescription: t('unavailableDescription'),
    forbiddenTitle: t('forbiddenTitle'),
    forbiddenDescription: t('forbiddenDescription'),
    invalidTitle: t('invalidTitle'),
    invalidDescription: t('invalidDescription'),
    expiredTitle: t('expiredTitle'),
    expiredDescription: t('expiredDescription'),
    emptyTitle: t('emptyTitle'),
    emptyDescription: t('emptyDescription'),
    page: t('page'),
    of: t('of'),
    previous: t('previous'),
    next: t('next'),
    rows: t('rows'),
    apply: t('apply'),
    clear: t('clear'),
    newestFirst: t('newestFirst'),
    viewDetails: t('viewDetails'),
  };

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-5 py-4 sm:px-8">
        <Link
          href="/"
          aria-label={t('back')}
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <BrandLogo showTagline={false} />
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <LocaleSwitcher />
          <ThemeSwitcher
            initialTheme={theme}
            labels={{
              title: admin('themeLabel'),
              system: admin('themeSystem'),
              light: admin('themeLight'),
              dark: admin('themeDark'),
            }}
          />
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-6xl space-y-7 px-5 py-9 sm:px-8">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex rounded-md text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t('back')}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="max-w-2xl text-muted-foreground">{t('intro')}</p>
        </div>
        <Card className="space-y-5 p-5 sm:p-6">
          <UsersTable
            result={result}
            filters={filters}
            locale={locale === 'en' ? 'en' : 'uk'}
            copy={copy}
          />
        </Card>
      </main>
    </div>
  );
}
