import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';

import { readAdminSession } from '@/shared/api/admin-session';

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
      <main className="mx-auto max-w-3xl space-y-3 px-6 py-16" role="alert">
        <h1 className="text-2xl font-semibold" >{t('unavailableTitle')}</h1>
        <p className="text-muted-foreground">{messages[session.kind]}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-6 py-16">
      <p className="text-xs font-semibold tracking-widest text-primary uppercase">
        Gym Platform Admin
      </p>
      <h1 className="text-3xl font-bold" >{t('title')}</h1>
      <p className="max-w-2xl text-muted-foreground" >{t('accessConfirmed')}</p>
      <p className="max-w-2xl text-muted-foreground">
        {t('comingSoon')}
      </p>
    </main>
  );
}
