import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { verifyServerSession } from '@/shared/api/server-session';
import { DashboardScreen } from '@/widgets/dashboard/ui/dashboard-screen';

export const metadata: Metadata = {
  title: 'Кабінет | Gym Platform',
};

// Every request must verify with NestJS; never statically cache private content.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const session = await verifyServerSession(cookieHeader);

  if (session.kind === 'unauthenticated') redirect('/login');

  if (session.kind === 'forbidden') {
    return (
      <main className="mx-auto max-w-3xl space-y-3 px-6 py-16">
        <h1 className="text-2xl font-semibold">Доступ заборонено</h1>
        <p className="text-muted-foreground">Немає дозволу переглядати цей ресурс.</p>
      </main>
    );
  }

  if (session.kind === 'unavailable') {
    return (
      <main className="mx-auto max-w-3xl space-y-3 px-6 py-16" role="alert">
        <h1 className="text-2xl font-semibold">Сервіс тимчасово недоступний</h1>
        <p className="text-muted-foreground">
          Не вдалося перевірити сесію. Оновіть сторінку пізніше.
        </p>
      </main>
    );
  }

  return <DashboardScreen initialUser={session.user} />;
}
