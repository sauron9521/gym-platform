import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { ExerciseDetails } from '@/features/exercises/ui/exercise-details';
import { verifyServerSession } from '@/shared/api/server-session';

export const metadata: Metadata = {
  title: 'Деталі вправи | Gym Platform',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default async function ExerciseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const session = await verifyServerSession(cookieHeader);

  if (session.kind === 'unauthenticated') redirect('/login');

  if (session.kind === 'forbidden') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Доступ заборонено</h1>
        <p className="mt-2 text-muted-foreground">Немає дозволу переглядати цю вправу.</p>
      </main>
    );
  }

  if (session.kind === 'unavailable') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16" role="alert">
        <h1 className="text-2xl font-semibold">Сервіс тимчасово недоступний</h1>
        <p className="mt-2 text-muted-foreground">
          Не вдалося перевірити сесію. Спробуйте пізніше.
        </p>
      </main>
    );
  }

  const { id } = await params;
  return <ExerciseDetails id={id} actor={session.user} />;
}
