import { useEffect, useState, type PropsWithChildren } from 'react';
import { QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';

import { isConnectionAvailable } from './network-state';
import { AppState, Platform } from 'react-native';

import { createMobileQueryClient } from './query-client';

function NativeAppFocusSync() {
  useEffect(() => {
    // The web QueryClient already tracks browser focus automatically.
    if (Platform.OS === 'web') return;

    focusManager.setFocused(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => {
      subscription.remove();
      focusManager.setFocused(undefined);
    };
  }, []);

  return null;
}

function NativeOnlineSync() {
  useEffect(() => {
    // On web, TanStack Query handles browser online/offline events itself.
    if (Platform.OS === 'web') return;

    let active = true;
    const updateOnline = (state: Network.NetworkState) => {
      if (active) onlineManager.setOnline(isConnectionAvailable(state));
    };

    void Network.getNetworkStateAsync().then(updateOnline).catch(() => undefined);
    const subscription = Network.addNetworkStateListener(updateOnline);

    return () => {
      active = false;
      subscription.remove();
      onlineManager.setOnline(undefined);
    };
  }, []);

  return null;
}

export function MobileQueryProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(createMobileQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <NativeAppFocusSync />
      <NativeOnlineSync />
      {children}
    </QueryClientProvider>
  );
}
