import { headers } from 'next/headers';

import { readAdminSession } from '@/shared/api/admin-session';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const cookie = (await headers()).get('cookie') ?? '';
  const session = await readAdminSession(cookie);

  if (session.kind !== 'admin') {
    const message =
      session.kind === 'unauthenticated'
        ? 'Для доступу потрібна окрема адміністративна сесія.'
        : session.kind === 'forbidden'
          ? 'У вас немає адміністративного доступу.'
          : 'Неможливо перевірити права. Спробуйте пізніше.';

    return (
      <main className="mx-auto max-w-3xl space-y-3 px-6 py-16" role="alert">
        <h1 className="text-2xl font-semibold">Адмін-панель недоступна</h1>
        <p className="text-muted-foreground">{message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-6 py-16">
      <p className="text-xs font-semibold tracking-widest text-primary uppercase">
        Gym Platform Admin
      </p>
      <h1 className="text-3xl font-bold">Адміністративна консоль</h1>
      <p className="max-w-2xl text-muted-foreground">
        Доступ підтверджено NestJS API. Управління користувачами, модерація та
        операційні метрики будуть додані після permission-based RBAC і журналу аудиту.
      </p>
    </main>
  );
}
