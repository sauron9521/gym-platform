'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { classifySessionCheck } from '@/features/auth/lib/auth-flow';
import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import type { AuthenticatedUser } from '@/shared/api/server-session';

type DashboardState =
  | { kind: 'loading' }
  | { kind: 'forbidden' }
  | { kind: 'error' }
  | { kind: 'ready'; email: string; displayName: string };

export function DashboardScreen({ initialUser }: { initialUser: AuthenticatedUser }) {
  const router = useRouter();
  const [state, setState] = useState<DashboardState>({
    kind: 'ready',
    email: initialUser.email,
    displayName: initialUser.displayName,
  });
  const [attempt, setAttempt] = useState(0);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void webApi
      .GET('/users/me')
      .then(({ data, response }) => {
        if (!active) return;

        const decision = classifySessionCheck(response.status, Boolean(data));
        if (decision === 'unauthenticated') {
          router.replace('/login');
          return;
        }
        if (decision === 'forbidden') {
          setState({ kind: 'forbidden' });
          return;
        }
        if (decision !== 'authenticated' || !data) {
          setState({ kind: 'error' });
          return;
        }

        setState({
          kind: 'ready',
          email: data.email,
          displayName: data.profile?.displayName || data.profile?.firstName || data.email,
        });
      })
      .catch(() => {
        if (active) setState({ kind: 'error' });
      });

    return () => {
      active = false;
    };
  }, [router, attempt]);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      const { response } = await webApi.POST('/auth/sign-out');
      if (response.status === 204 || response.status === 401) {
        router.replace('/login');
        router.refresh();
      } else {
        setSignOutError('Не вдалося завершити сесію. Спробуйте ще раз.');
      }
    } catch {
      setSignOutError('Немає з’єднання з API. Спробуйте ще раз.');
    } finally {
      setIsSigningOut(false);
    }
  }

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((value) => value + 1);
  }

  if (state.kind === 'loading') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16" role="status">
        Перевіряємо сесію…
      </main>
    );
  }

  if (state.kind === 'forbidden' || state.kind === 'error') {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <h1 className="text-2xl font-semibold">
          {state.kind === 'forbidden' ? 'Доступ заборонено' : 'Помилка з’єднання'}
        </h1>
        <p className="text-muted-foreground">
          {state.kind === 'forbidden'
            ? 'Немає дозволу переглянути цей ресурс.'
            : 'Не вдалося перевірити сесію. Спробуйте ще раз.'}
        </p>
        <Button variant="outline" onClick={retry}>
          Спробувати знову
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Gym Platform</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Вітаємо, {state.displayName}!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{state.email}</p>
        </div>
        <Button variant="outline" onClick={handleSignOut} disabled={isSigningOut}>
          {isSigningOut ? 'Вихід…' : 'Вийти'}
        </Button>
      </div>
      {signOutError && (
        <p role="alert" className="text-sm text-destructive">
          {signOutError}
        </p>
      )}
      <section className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Особистий кабінет</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Перегляньте свій журнал тренувань або оновіть особистий профіль.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/workouts">Мої тренування</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile">Мій профіль</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
