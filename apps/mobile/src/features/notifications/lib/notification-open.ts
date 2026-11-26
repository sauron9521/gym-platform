import { z } from 'zod';

import {
  hasAthleteAccess,
  parseAccountCapabilities,
} from '@/features/auth/model/account-capabilities';
import type { AccountCapabilities } from '@/features/auth/model/account-capabilities';
import { parseSafePushEnvelope } from './notification-policy';

/**
 * Local semantic target contract, NOT the future Inbox HTTP DTO.
 * The adapter must map a freshly authorized server detail and resource
 * access check to this narrow representation. Program IDs are assignment IDs,
 * not program template/version IDs.
 */
const targetSchema = z.strictObject({
  notificationId: z.uuid(),
  target: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('workout'), id: z.uuid() }),
    z.strictObject({ kind: z.literal('programAssignment'), id: z.uuid() }),
  ]),
});

export type NotificationOpenRoute = {
  pathname: '/workouts/[id]' | '/programs/[id]';
  params: { id: string };
};

/** Epoch identity must change on lock, logout, account switch or re-verification. */
export type VerifiedNotificationScope = Readonly<{
  ownerId: string;
  epoch: object;
  capabilities: AccountCapabilities;
}>;

type Dependencies = {
  getVerifiedScope: () => VerifiedNotificationScope | null;
  // Must be an authenticated, fresh, USER-scoped read with current resource
  // authorization. Never derive this result from OS payload or cached details.
  resolveAuthorizedTarget: (
    notificationId: string,
    scope: VerifiedNotificationScope,
    signal: AbortSignal,
  ) => Promise<unknown>;
  // Synchronous internal navigation only. Destination independently enforces access.
  navigate: (route: NotificationOpenRoute) => void;
};

export type NotificationOpenResult = 'opened' | 'invalid' | 'denied' | 'stale' | 'unavailable';

function validScope(scope: VerifiedNotificationScope | null): scope is VerifiedNotificationScope {
  return Boolean(
    scope &&
    z.uuid().safeParse(scope.ownerId).success &&
    scope.epoch &&
    typeof scope.epoch === 'object' &&
    hasAthleteAccess(parseAccountCapabilities(scope.capabilities)),
  );
}

/**
 * A single explicit intent, not a queue or a push handler. Superseding intents
 * cancel the previous attempt; logout/background must call cancel as well as
 * invalidating the verified scope. No automatic replay on sign-in/reconnect.
 * No network or router is configured in the current app.
 */
export function createNotificationOpenCoordinator(dependencies: Dependencies) {
  let active: AbortController | null = null;

  function cancel() {
    const previous = active;
    active = null;
    previous?.abort();
  }

  async function open(value: unknown): Promise<NotificationOpenResult> {
    cancel();
    let controller: AbortController | undefined;
    try {
      const envelope = parseSafePushEnvelope(value);
      if (!envelope) return 'invalid';
      const initial = dependencies.getVerifiedScope();
      if (!validScope(initial)) return 'denied';
      // Copy the primitive ID and epoch identity rather than retaining mutable
      // provider state as the comparison baseline.
      const ownerId = initial.ownerId;
      const epoch = initial.epoch;
      const scope = { ownerId, epoch, capabilities: { ...initial.capabilities } };
      const attempt = new AbortController();
      controller = attempt;
      active = attempt;
      const isCurrent = () => {
        const current = dependencies.getVerifiedScope();
        return (
          active === attempt &&
          !attempt.signal.aborted &&
          validScope(current) &&
          current.ownerId === ownerId &&
          current.epoch === epoch
        );
      };
      if (!isCurrent()) return 'stale';
      const result = await dependencies.resolveAuthorizedTarget(
        envelope.notificationId,
        scope,
        attempt.signal,
      );
      if (!isCurrent()) return 'stale';
      const parsed = targetSchema.safeParse(result);
      if (!parsed.success || parsed.data.notificationId !== envelope.notificationId)
        return 'denied';
      const target = parsed.data.target;
      const route: NotificationOpenRoute = {
        pathname: target.kind === 'workout' ? '/workouts/[id]' : '/programs/[id]',
        params: { id: target.id },
      };
      if (!isCurrent()) return 'stale';
      dependencies.navigate(route);
      return 'opened';
    } catch {
      return controller && (controller.signal.aborted || active !== controller)
        ? 'stale'
        : 'unavailable';
    } finally {
      if (controller && active === controller) active = null;
    }
  }

  return { open, cancel };
}
