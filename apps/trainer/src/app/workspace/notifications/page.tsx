import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { verifyTrainerAccess } from '@/shared/api/server-capability';
import { TrainerInboxScreen } from '@/features/notifications/ui/inbox-screen';

export const dynamic = 'force-dynamic';
export default async function NotificationsPage() {
  const access = await verifyTrainerAccess((await headers()).get('cookie') ?? '');
  if (access.kind === 'allowed') return <TrainerInboxScreen />;
  const t = await getTranslations('web.notifications');
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p role="alert">{t(access.kind === 'unavailable' ? 'sessionError' : 'forbidden')}</p>
      <Link href="/login" className="text-primary underline">
        OVRANTO
      </Link>
    </section>
  );
}
