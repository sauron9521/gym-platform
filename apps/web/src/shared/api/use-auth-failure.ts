'use client';

import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

/**
 * Handle an expired browser session in one place. Never preserve private
 * queries across a sign-in boundary. Only HTTP 401 triggers this flow:
 * network errors, 403, 409 and 5xx must leave the session intact.
 */
export function useAuthFailure() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const redirecting = useRef(false);

  return useCallback(
    (error: { status?: number }) => {
      if (error.status !== 401 || redirecting.current) return;
      redirecting.current = true;
      queryClient.clear();
      router.replace('/login');
    },
    [queryClient, router],
  );
}
