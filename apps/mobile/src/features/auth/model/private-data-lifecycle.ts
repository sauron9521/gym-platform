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
