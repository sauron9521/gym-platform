import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { CreateWorkoutForm } from '@/features/workouts/ui/create-workout-form';
import { verifyServerSession } from '@/shared/api/server-session';

export const metadata: Metadata = {
  title: 'Нове тренування | Gym Platform',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default async function CreateWorkoutPage() {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const session = await verifyServerSession(cookieHeader);

  if (session.kind === 'unauthenticated') redirect('/login');

  if (session.kind === 'forbidden') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Доступ заборонено</h1>
        <p className="mt-2 text-muted-foreground">Немає дозволу створювати тренування.</p>
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

  return <CreateWorkoutForm />;
}
