import type { AccountCapabilities } from './account-capabilities';

/** Auth publishes verified identity and synchronous lock boundaries, not storage details. */
export interface PrivateDataLifecycle {
  lock(): void;
  verified(ownerId: string, capabilities: AccountCapabilities): Promise<void>;
  end(): Promise<void>;
}

export const noPrivateDataLifecycle: PrivateDataLifecycle = {
  lock: () => undefined,
  verified: async () => undefined,
  end: async () => undefined,
};

/** Lock every participant synchronously; wait for independent cleanup without
 * allowing one participant's rejection to skip another participant. */
export function combinePrivateDataLifecycles(
  ...participants: PrivateDataLifecycle[]
): PrivateDataLifecycle {
  // Call each participant immediately (not in a deferred microtask) so
  // synchronous generation fences close before Auth clears credentials.
  const invoke = (operation: (participant: PrivateDataLifecycle) => Promise<void>) =>
    participants.map((participant) => {
      try {
        return operation(participant);
      } catch (error) {
        return Promise.reject(error);
      }
    });
  return {
    lock() {
      for (const participant of participants) {
        try {
          participant.lock();
        } catch {
          /* Still fence other participants. */
        }
      }
    },
    async verified(ownerId, capabilities) {
      await Promise.allSettled(
        invoke((participant) => participant.verified(ownerId, capabilities)),
      );
    },
    async end() {
      await Promise.allSettled(invoke((participant) => participant.end()));
    },
  };
}
