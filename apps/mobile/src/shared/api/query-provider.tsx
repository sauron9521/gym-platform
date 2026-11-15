import { useEffect, useState, type PropsWithChildren } from 'react';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
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

export function MobileQueryProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(createMobileQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <NativeAppFocusSync />
      {children}
    </QueryClientProvider>
  );
}
