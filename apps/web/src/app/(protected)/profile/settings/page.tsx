import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { NotificationSettingsPanel } from '@/features/notifications/ui/notification-settings-panel';
import { WorkoutPreferencesSettings } from '@/features/app-settings/ui/workout-preferences-settings';
import { verifyServerSession } from '@/shared/api/server-session';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.appSettings');
  return { title: `${t('title')} | Gym Platform`, robots: { index: false } };
}

export default async function AppSettingsPage() {
  const t = await getTranslations('web.profile');
  const session = await verifyServerSession((await headers()).get('cookie') ?? '');
  if (session.kind === 'unauthenticated') redirect('/login');
  if (session.kind !== 'authenticated') {
    return (
      <main role="alert" className="mx-auto max-w-3xl px-6 py-16">
        {session.kind === 'forbidden' ? t('forbidden') : t('sessionUnavailable')}
      </main>
    );
  }
  return (
    <WorkoutPreferencesSettings key={session.user.id} accountId={session.user.id}>
      <NotificationSettingsPanel accountId={session.user.id} />
    </WorkoutPreferencesSettings>
  );
}
