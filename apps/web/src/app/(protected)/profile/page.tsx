import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { ProfileEditor } from '@/features/profile/ui/profile-editor';
import { verifyServerSession } from '@/shared/api/server-session';

export const metadata: Metadata = {
  title: 'Мій профіль | Gym Platform',
  robots: { index: false },
};
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const session = await verifyServerSession(cookieHeader);
  if (session.kind === 'unauthenticated') redirect('/login');
  if (session.kind === 'forbidden') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Доступ заборонено</h1>
      </main>
    );
  }
  if (session.kind === 'unavailable') {
    return (
      <main role="alert" className="mx-auto max-w-3xl px-6 py-16">
        Не вдалося перевірити сесію. Спробуйте пізніше.
      </main>
    );
  }
  return <ProfileEditor />;
}
