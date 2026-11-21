import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { TrainerProgramDetails } from '@/features/training-programs/ui/trainer-program-details';
import { verifyServerCapability } from '@/shared/api/server-session';

export const metadata: Metadata = {
  title: 'Деталі тренувальної програми | Gym Platform',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default async function TrainerProgramDetailsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const session = await verifyServerCapability(cookieHeader, 'trainer');

  if (session.kind === 'unauthenticated') redirect('/login');

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

  if (session.kind !== 'authenticated') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Доступ заборонено</h1>
        <p className="mt-2 text-muted-foreground">
          Перегляд і редагування програм доступні лише тренерам.
        </p>
      </main>
    );
  }

  const { programId } = await params;
  if (!z.uuid().safeParse(programId).success) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Програму не знайдено</h1>
      </main>
    );
  }

  return <TrainerProgramDetails programId={programId} />;
}
