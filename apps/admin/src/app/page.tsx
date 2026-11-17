import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';

import { readAdminSession } from '@/shared/api/admin-session';
import { readAdminHealth } from '@/shared/api/admin-health';

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
        <h1 className="text-2xl font-semibold">{t('unavailableTitle')}</h1>
        <p className="text-muted-foreground">{messages[session.kind]}</p>
      </main>
    );
  }

  // Do not query or display readiness until the server has verified ADMIN.
  const readiness = await readAdminHealth();

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-6 py-16">
      <p className="text-xs font-semibold tracking-widest text-primary uppercase">
        Gym Platform Admin
      </p>
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="max-w-2xl text-muted-foreground">{t('accessConfirmed')}</p>
      <section aria-labelledby="admin-readiness-heading" className="rounded-xl border p-5">
        <h2 id="admin-readiness-heading" className="mb-2 text-lg font-semibold">
          {t('readinessTitle')}
        </h2>
        <p role="status" className="text-sm text-muted-foreground">
          {readiness === 'healthy' ? t('readinessHealthy') : t('readinessDegraded')}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{t('readinessDisclaimer')}</p>
      </section>
      <section aria-labelledby="admin-modules-heading" className="rounded-xl border p-5">
        <h2 id="admin-modules-heading" className="mb-2 text-lg font-semibold">
          {t('plannedModulesTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('comingSoon')}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t('unavailableFeatures')}</p>
      </section>
    </main>
  );
}
