import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { InboxPageScreen } from '@/features/notifications/ui/inbox-page';
import { verifyServerSession } from '@/shared/api/server-session';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.notifications');
  return { title: t('title'), robots: { index: false } };
}

export default async function NotificationsPage() {
  const session = await verifyServerSession((await headers()).get('cookie') ?? '');
  if (session.kind === 'unauthenticated') redirect('/login');
  if (session.kind !== 'authenticated' || session.user.role === 'ADMIN') {
    const t = await getTranslations('web.notifications');
    return (
      <main className="mx-auto max-w-3xl px-6 py-12" role="alert">
        {t(session.kind === 'unavailable' ? 'sessionError' : 'forbidden')}
      </main>
    );
  }
  return <InboxPageScreen />;
}
