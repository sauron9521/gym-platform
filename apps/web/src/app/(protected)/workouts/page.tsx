import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { verifyServerSession } from '@/shared/api/server-session';
import { WorkoutsList } from '@/features/workouts/ui/workouts-list';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.workoutList');
  return { title: `${t('title')} | OVRANTO`, robots: { index: false } };
}

export const dynamic = 'force-dynamic';

export default async function WorkoutsPage() {
  const t = await getTranslations('web.workoutList');
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const session = await verifyServerSession(cookieHeader);

  if (session.kind === 'unauthenticated') redirect('/login');

  if (session.kind === 'forbidden') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">{t('forbiddenTitle')}</h1>
        <p className="mt-2 text-muted-foreground">{t('forbiddenDescription')}</p>
      </main>
    );
  }

  if (session.kind === 'unavailable') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16" role="alert">
        <h1 className="text-2xl font-semibold">{t('unavailableTitle')}</h1>
        <p className="mt-2 text-muted-foreground">
          Не вдалося перевірити сесію. Спробуйте пізніше.
        </p>
      </main>
    );
  }

  return <WorkoutsList />;
}
