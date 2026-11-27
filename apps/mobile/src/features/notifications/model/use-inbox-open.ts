import { useCallback, useEffect, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppState } from 'react-native';

import { createNotificationOpenCoordinator } from '../lib/notification-open';
import { resolveProgramTarget, type InboxScope } from '../services/inbox-api';

export function useInboxOpen(scope: InboxScope | null) {
  const router = useRouter();
  const coordinator = useMemo(
    () =>
      createNotificationOpenCoordinator({
        getVerifiedScope: () =>
          scope?.epoch && scope.isCurrent()
            ? { ownerId: scope.ownerId, epoch: scope.epoch, capabilities: scope.capabilities }
            : null,
        resolveAuthorizedTarget: (id, _verified, signal) =>
          scope ? resolveProgramTarget(scope, id, signal) : Promise.resolve(null),
        navigate: (route) => router.push(route),
      }),
    [router, scope],
  );
  useFocusEffect(useCallback(() => () => coordinator.cancel(), [coordinator]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') coordinator.cancel();
    });
    return () => {
      coordinator.cancel();
      sub.remove();
    };
  }, [coordinator]);
  return coordinator;
}
