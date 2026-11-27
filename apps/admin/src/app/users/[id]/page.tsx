import { BrandLogo, Card } from '@gym/ui-web';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';

import { readAdminSession } from '@/shared/api/admin-session';
import { readAdminUserDetail } from '@/shared/api/admin-user-detail';
import { parseThemePreference, THEME_COOKIE_NAME } from '@/shared/lib/theme-preference';
import { AdminNotificationBell } from '@/features/notifications/ui/admin-inbox-bell';
import { LocaleSwitcher } from '@/shared/ui/locale-switcher';
import { ThemeSwitcher } from '@/shared/ui/theme-switcher';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [admin, t, users, locale] = await Promise.all([
    getTranslations('admin'),
    getTranslations('admin.users.detail'),
    getTranslations('admin.users'),
    getLocale(),
  ]);
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const session = await readAdminSession(cookieHeader);
  if (session.kind !== 'admin') {
    const copy = {
      unauthenticated: admin('unauthenticated'),
      forbidden: admin('forbidden'),
      unavailable: admin('unavailable'),
    };
    return (
      <main id="main-content" role="alert" className="mx-auto max-w-3xl space-y-3 px-6 py-16">
        <h1 className="text-2xl font-semibold">{admin('unavailableTitle')}</h1>
        <p className="text-muted-foreground">{copy[session.kind]}</p>
      </main>
    );
  }

  // This fetch is never made for unauthenticated/non-ADMIN sessions. The Nest
  // endpoint separately checks the persisted allowlisted operator permission.
  const { id } = await params;
  const result = await readAdminUserDetail(cookieHeader, id);

  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE_NAME)?.value);
  const explanations = {
    unauthenticated: [t('expiredTitle'), t('expiredDescription')],
    forbidden: [t('forbiddenTitle'), t('forbiddenDescription')],
    'not-found': [t('notFoundTitle'), t('notFoundDescription')],
    invalid: [t('notFoundTitle'), t('notFoundDescription')],
    unavailable: [t('unavailableTitle'), t('unavailableDescription')],
  } as const;

  const format = (date: string) =>
    new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'uk-UA', {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(new Date(date));
  const user = result.kind === 'ready' ? result.user : null;
  const failure = result.kind === 'ready' ? null : explanations[result.kind];

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-5 py-4 sm:px-8">
        <Link href="/" aria-label={users('back')}>
          <BrandLogo showTagline={false} />
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <AdminNotificationBell owner={session.id} />
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
      <main id="main-content" className="mx-auto max-w-4xl space-y-7 px-5 py-9 sm:px-8">
        <div className="space-y-3">
          <Link
            href="/users"
            className="inline-flex rounded-md text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t('back')}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Card className="space-y-5 p-5 sm:p-6">
          {!user ? (
            <div role="alert" className="space-y-2">
              <h2 className="text-lg font-semibold">{failure?.[0]}</h2>
              <p className="text-sm text-muted-foreground">{failure?.[1]}</p>
            </div>
          ) : (
            <section aria-label={t('accountDetails')}>
              <h2 className="mb-6 text-xl font-semibold">{user.email}</h2>
              <dl className="grid gap-x-7 gap-y-5 sm:grid-cols-2">
                {[
                  [t('id'), user.id],
                  [users('email'), user.email],
                  [
                    users('role'),
                    { ATHLETE: users('athlete'), TRAINER: users('trainer'), ADMIN: users('admin') }[
                      user.role
                    ],
                  ],
                  [
                    users('status'),
                    user.status === 'SUSPENDED' ? users('suspended') : users('active'),
                  ],
                  [t('emailVerified'), user.emailVerified ? t('verified') : t('notVerified')],
                  [users('joined'), format(user.createdAt)],
                  [t('updated'), format(user.updatedAt)],
                ].map(([name, value]) => (
                  <div key={name} className="min-w-0 space-y-1 border-b border-border pb-4">
                    <dt className="text-xs font-semibold tracking-wide text-muted-foreground">
                      {name}
                    </dt>
                    <dd className="break-words text-sm font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-7 text-sm text-muted-foreground">{t('readOnly')}</p>
            </section>
          )}
        </Card>
      </main>
    </div>
  );
}
