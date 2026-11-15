'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { WebToaster } from '@/shared/ui/web-toaster';

export function WebQueryProvider({ children }: { children: ReactNode }) {
  // Each browser app instance gets its own in-memory cache, never server-shared or persisted.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            gcTime: 60_000,
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <WebToaster />
    </QueryClientProvider>
  );
}
