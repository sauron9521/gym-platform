import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useStore } from 'zustand';
import type { QueryClient } from '@tanstack/react-query';

import { type RestDuration } from '@/shared/config/rest-duration';
import { MobileAccessDeniedError, MobileReadHttpError } from '@/shared/api/api-error-policy';
import { accountQueryKeys } from '@/shared/api/query-client';
import { useRestFeedback, type RestFeedback } from '../lib/use-rest-feedback';
import { createRestTimerStore, type RestTimerStore } from './rest-timer-store';
import type { WorkoutDetails } from './workout-details-query';
import type { useWorkoutsQuery } from './workouts-query';

type WorkoutListData = NonNullable<ReturnType<typeof useWorkoutsQuery>['data']>;

const RestTimerContext = createContext<RestTimerStore | null>(null);

type Props = PropsWithChildren<{
  accountId: string | null;
  defaultDuration: RestDuration;
  feedback: RestFeedback;
  queryClient?: QueryClient;
}>;

export function RestTimerProvider({
  children,
  accountId,
  defaultDuration,
  feedback,
  queryClient,
}: Props) {
  // Keep navigation mounted on account changes, but replace the private store.
  const store = useMemo(() => createRestTimerStore(accountId), [accountId]);
  useEffect(
    () => () => {
      const scope = store.getState().timer?.scope;
      if (scope) store.getState().clearWorkout(scope.workoutId);
    },
    [store],
  );
  return (
    <RestTimerContext.Provider value={store}>
      {accountId ? (
        <RestTimerRuntime
          key={accountId}
          store={store}
          accountId={accountId}
          defaultDuration={defaultDuration}
          feedback={feedback}
          queryClient={queryClient}
        />
      ) : null}
      {children}
    </RestTimerContext.Provider>
  );
}

function RestTimerRuntime({
  store,
  accountId,
  defaultDuration,
  feedback,
  queryClient,
}: Omit<Props, 'children' | 'accountId'> & { store: RestTimerStore; accountId: string }) {
  const deadline = useStore(store, (state) => state.timer?.deadline ?? null);
  const notify = useRestFeedback();
  const { sound, vibration } = feedback;
  useEffect(() => store.getState().syncDefault(defaultDuration), [store, defaultDuration]);

  // Observe only verified account/workout cache updates, including completion
  // or cancellation acknowledged after the details screen has unmounted.
  useEffect(() => {
    if (!queryClient) return;
    return queryClient.getQueryCache().subscribe((event) => {
      const scope = store.getState().timer?.scope;
      if (!scope) return;
      const key = accountQueryKeys.workoutDetail(accountId, scope.workoutId);
      const queryKey = event.query.queryKey;
      if (queryKey.length === key.length && key.every((part, index) => queryKey[index] === part)) {
        const workout = event.query.state.data as WorkoutDetails | undefined;
        const error = event.query.state.error;
        const inaccessible =
          event.type === 'updated' &&
          event.action.type === 'error' &&
          (error instanceof MobileAccessDeniedError ||
            (error instanceof MobileReadHttpError &&
              (error.status === 403 || error.status === 404)));
        if (inaccessible || (workout && workout.status !== 'IN_PROGRESS')) {
          store.getState().clearWorkout(scope.workoutId);
        }
        return;
      }
      // A list refresh may reveal completion/cancellation while details are
      // unmounted. Absence from a filtered/paginated list is not proof.
      const listKey = accountQueryKeys.workouts(accountId);
      if (
        event.type !== 'updated' ||
        event.action.type !== 'success' ||
        queryKey.length !== listKey.length + 1 ||
        !listKey.every((part, index) => queryKey[index] === part)
      )
        return;
      const list = event.query.state.data as WorkoutListData | undefined;
      if (
        list?.pages?.some((page) =>
          page.data.some(
            (workout) =>
              workout.id === scope.workoutId &&
              (workout.status === 'COMPLETED' || workout.status === 'CANCELLED'),
          ),
        )
      )
        store.getState().clearWorkout(scope.workoutId);
    });
  }, [store, accountId, queryClient]);

  useEffect(() => {
    if (deadline === null) return;
    let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const refresh = () => {
      if (!foreground || !store.getState().refresh(Date.now())) return;
      // Audio initialization is asynchronous. A reset, restart, logout or
      // workout switch must invalidate the already-consumed expiration.
      const completed = store.getState().timer;
      notify(
        { sound, vibration },
        () => completed !== null && store.getState().timer === completed,
      );
    };
    const subscription = AppState.addEventListener('change', (state) => {
      foreground = state === 'active';
      refresh();
    });
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [store, deadline, notify, sound, vibration]);

  return null;
}

export function useRestTimerStore() {
  const store = useContext(RestTimerContext);
  if (!store) throw new Error('useRestTimerStore requires RestTimerProvider');
  return store;
}
