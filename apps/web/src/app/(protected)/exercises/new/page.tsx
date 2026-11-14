import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { CreateExerciseForm } from '@/features/exercises/ui/create-exercise-form';
import { verifyServerSession } from '@/shared/api/server-session';

export const metadata: Metadata = {
  title: 'Нова вправа | Gym Platform',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default async function NewExercisePage() {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const session = await verifyServerSession(cookieHeader);

  if (session.kind === 'unauthenticated') redirect('/login');

  if (session.kind === 'forbidden' || (session.kind === 'authenticated' && session.user.role === 'ADMIN')) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Доступ заборонено</h1>
        <p className="mt-2 text-muted-foreground">
          Створення власних вправ доступне атлетам і тренерам.
        </p>
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

  return <CreateExerciseForm role={session.user.role} />;
}
