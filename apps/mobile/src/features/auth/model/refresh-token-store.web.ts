import type { RefreshTokenStore } from './mobile-token-session';

/** Expo Web stays memory-only. Never persist bearer credentials in browser storage. */
export const refreshTokenStore: RefreshTokenStore = {
  read: async () => null,
  write: async () => undefined,
  remove: async () => undefined,
};
