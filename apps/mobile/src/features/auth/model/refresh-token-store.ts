import * as SecureStore from 'expo-secure-store';

import type { RefreshTokenStore } from './mobile-token-session';

const KEY = 'gym-platform.refresh-token.v1';

/** Only the opaque refresh token lives in Keychain / encrypted Android Keystore. */
export const refreshTokenStore: RefreshTokenStore = {
  read: () => SecureStore.getItemAsync(KEY),
  write: (refreshToken) =>
    SecureStore.setItemAsync(KEY, refreshToken, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  remove: () => SecureStore.deleteItemAsync(KEY),
};
