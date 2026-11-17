import { headers } from 'next/headers';

import { readAdminSession } from '@/shared/api/admin-session';
import { readAdminHealth } from '@/shared/api/admin-health';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const cookie = (await headers()).get('cookie') ?? '';
  const session = await readAdminSession(cookie);

  if (session.kind !== 'admin') {
    const messages = {
      unauthenticated: 'Для доступу потрібна окрема адміністративна сесія.',
      forbidden: 'У вас немає адміністративного доступу.',
      unavailable: 'Неможливо перевірити права. Спробуйте пізніше.',
    };

    return (
      <main className="mx-auto max-w-3xl space-y-3 px-6 py-16" role="alert">
        <h1 className="text-2xl font-semibold">Адмін-панель недоступна</h1>
        <p className="text-muted-foreground">{messages[session.kind]}</p>
      </main>
    );
  }

  const readiness = await readAdminHealth();

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-6 py-16">
      <p className="text-xs font-semibold tracking-widest text-primary uppercase">
        Gym Platform Admin
      </p>
      <h1 className="text-3xl font-bold">Адміністративна консоль</h1>
      <p className="max-w-2xl text-muted-foreground">Доступ підтверджено NestJS API.</p>
      <section aria-label="Стан сервісів" className="rounded-xl border p-5">
        <h2 className="mb-2 text-lg font-semibold">Стан API</h2>
        <p className="text-sm text-muted-foreground">
          {readiness === 'healthy'
            ? 'API ready: PostgreSQL і rate limiting відповідають.'
            : 'API readiness не підтверджений. Перевірте сервіси та логи.'}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Це лише перевірка готовності, не бізнес-метрики чи гарантія доступності.
        </p>
      </section>
      <section aria-label="Незапущені функції" className="rounded-xl border p-5">
        <h2 className="mb-2 text-lg font-semibold">Плановані модулі</h2>
        <p className="text-sm text-muted-foreground">
          Функції модерації та метрики з’являться після додавання RBAC і журналу аудиту.
          Управління вправами, категоріями й акаунтами зараз недоступне.
        </p>
      </section>
    </main>
  );
}
