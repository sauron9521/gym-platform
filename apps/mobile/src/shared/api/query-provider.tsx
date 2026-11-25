import { useEffect, useState, type PropsWithChildren } from 'react';
import { QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';

import { subscribeToConnectionState } from './network-state';
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

    const unsubscribe = subscribeToConnectionState(
      Network.getNetworkStateAsync,
      Network.addNetworkStateListener,
      (online) => onlineManager.setOnline(online),
    );

    return () => {
      unsubscribe();
      onlineManager.setOnline(true);
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
