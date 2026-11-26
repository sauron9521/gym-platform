import { useSyncExternalStore } from 'react';
import { onlineManager, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/model/auth-context';
import { hasAthleteAccess } from '@/features/auth/model/account-capabilities';
import { accountQueryKeys } from '@/shared/api/query-client';
import type { CreateWorkoutBody, MobileMultiWorkoutForm } from '../lib/create-workout-schema';
import type { OfflineDraftLifecycle } from './offline-draft-lifecycle';

const isOnline = () => onlineManager.isOnline();
const subscribe = (listener: () => void) => onlineManager.subscribe(listener);

export function useReviewedDraftSubmission(lifecycle: OfflineDraftLifecycle) {
  const { account, capabilities, getScopedApi } = useAuth();
  const queryClient = useQueryClient();
  const online = useSyncExternalStore(subscribe, isOnline, isOnline);
  const ownerId = account?.id;
  const allowed = Boolean(ownerId && hasAthleteAccess(capabilities));

  async function send(form: MobileMultiWorkoutForm, generation: number) {
    if (!ownerId || !allowed) throw new Error('draft-send-blocked');
    // Lazy import: unsupported native clients keep ordinary online creation.
    const { randomUUID } = await import('expo-crypto');
    const receipt = await lifecycle.submitReviewed({
      ownerId,
      generation,
      form,
      explicitlyConfirmed: true,
      isOnline,
      createKey: () => `draft-${randomUUID()}`,
      send: async (attempt, isCurrent) => {
        const api = getScopedApi(isCurrent);
        if (!api || !isCurrent()) throw new Error('draft-send-blocked');
        // bodyJson was validated against the canonical form at the persistence boundary.
        const response = await api.POST('/workouts', {
          headers: { 'Idempotency-Key': attempt.key },
          body: JSON.parse(attempt.bodyJson) as CreateWorkoutBody,
        });
        if (response.response.status !== 201 || !response.data)
          throw new Error('draft-send-unconfirmed');
        return response.data;
      },
    });
    if (lifecycle.isCurrentOwner(ownerId, generation)) {
      void queryClient
        .invalidateQueries({ queryKey: accountQueryKeys.workouts(ownerId) })
        .catch(() => undefined);
    }
    return receipt;
  }

  async function clear(generation: number) {
    if (!ownerId || !allowed) throw new Error('draft-send-blocked');
    await lifecycle.clearSubmitted(ownerId, generation);
  }

  return { online, allowed, send, clear };
}
