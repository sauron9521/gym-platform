'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { classifySessionCheck } from '@/features/auth/lib/auth-flow';
import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { DashboardHome } from './dashboard-home';
import { DashboardActiveWorkout } from './dashboard-active-workout';
import { DashboardCompletedSessions } from './dashboard-completed-sessions';
import { DashboardPlannedWorkouts } from './dashboard-planned-workouts';
import { DashboardWorkoutStats } from './dashboard-workout-stats';
import type { AuthenticatedUser } from '@/shared/api/server-session';

type DashboardState =
  | { kind: 'loading' }
  | { kind: 'forbidden' }
  | { kind: 'error' }
  | { kind: 'ready'; email: string; displayName: string };

export function DashboardScreen({ initialUser }: { initialUser: AuthenticatedUser }) {
  const router = useRouter();
  const queryClient = useQueryClient();
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
        queryClient.clear();
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
    <DashboardHome
      email={state.email}
      displayName={state.displayName}
      role={initialUser.role}
      isSigningOut={isSigningOut}
      signOutError={signOutError}
      onSignOut={handleSignOut}
      hero={initialUser.role === 'ATHLETE' ? <DashboardActiveWorkout /> : undefined}
    >
      {initialUser.role === 'ATHLETE' && (
        <>
          <DashboardWorkoutStats />
          <DashboardPlannedWorkouts />
          <DashboardCompletedSessions />
        </>
      )}
    </DashboardHome>
  );
}
