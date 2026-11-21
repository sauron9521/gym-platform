import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClientProvider, QueryObserver, onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/features/auth/model/auth-context';
import {
  useWorkoutSetMutation,
  WorkoutSetOutcomeUnknownError,
  WorkoutSetRateLimitError,
} from '@/features/workouts/model/workout-set-mutation';
import { accountQueryKeys, createMobileQueryClient } from '@/shared/api/query-client';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));

const patch = vi.fn();
const signOut = vi.fn();
const accountId = 'athlete-1';
const workoutId = 'workout-1';
const setId = 'set-1';
const payload = { setId, body: { status: 'SKIPPED' as const } };

async function harness({
  read = async () => ({ status: 'COMPLETED' }),
  seedAccount = true,
}: {
  read?: () => Promise<{ status: string }>;
  seedAccount?: boolean;
} = {}) {
  const client = createMobileQueryClient();
  const key = accountQueryKeys.workoutDetail(accountId, workoutId);
  if (seedAccount) client.setQueryData(accountQueryKeys.me(accountId), { id: accountId });
  client.setQueryData(key, { status: 'PENDING' });
  const get = vi.fn(read);
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: async () => {
      const value = await get();
      client.setQueryData<number>(
        accountQueryKeys.workoutDetailRead(accountId, workoutId),
        (current) => (current ?? 0) + 1,
      );
      return value;
    },
    staleTime: Infinity,
    retry: false,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  vi.mocked(useAuth).mockReturnValue({
    account: { id: accountId },
    getApi: () => ({ PATCH: patch }),
    signOut,
  } as unknown as ReturnType<typeof useAuth>);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const rendered = await renderHook(() => useWorkoutSetMutation(workoutId), { wrapper });
  return {
    ...rendered,
    get,
    client,
    dispose: async () => {
      await rendered.unmount();
      unsubscribe();
      client.clear();
    },
  };
}

async function submit(result: Awaited<ReturnType<typeof harness>>['result']) {
  let caught: unknown;
  await act(async () => {
    try {
      await result.current.mutateAsync(payload);
    } catch (error) {
      caught = error;
    }
  });
  return caught;
}

describe('WorkoutSetMutation uncertain PATCH outcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onlineManager.setOnline(true);
  });
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('a lost response checks GET once and never automatically repeats PATCH', async () => {
    patch.mockRejectedValue(new TypeError('socket closed; do not show transport details'));
    const h = await harness();
    try {
      await new Promise((resolve) => setTimeout(resolve, 3));
      const error = await submit(h.result);
      expect(error).toBeInstanceOf(WorkoutSetOutcomeUnknownError);
      expect((error as WorkoutSetOutcomeUnknownError).canonicalStateVerified).toBe(true);
      expect((error as Error).message).not.toContain('socket');
      expect(patch).toHaveBeenCalledTimes(1);
      expect(h.get).toHaveBeenCalledTimes(1);
      expect(h.client.getQueryData(accountQueryKeys.workoutDetail(accountId, workoutId))).toEqual({
        status: 'COMPLETED',
      });
    } finally {
      await h.dispose();
    }
  });

  it('HTTP 503 after a possible server write runs GET but not a second PATCH', async () => {
    patch.mockResolvedValue({ response: { status: 503, headers: new Headers() } });
    const h = await harness();
    try {
      const error = await submit(h.result);
      expect(error).toBeInstanceOf(WorkoutSetOutcomeUnknownError);
      expect(patch).toHaveBeenCalledTimes(1);
      expect(h.get).toHaveBeenCalledTimes(1);
    } finally {
      await h.dispose();
    }
  });

  it.each([409, 429])('known rejected HTTP %s does not trigger reconciliation', async (status) => {
    patch.mockResolvedValue({
      response: { status, headers: new Headers({ 'retry-after': '15' }) },
    });
    const h = await harness();
    try {
      const error = await submit(h.result);
      expect(error).not.toBeInstanceOf(WorkoutSetOutcomeUnknownError);
      if (status === 429) expect(error).toBeInstanceOf(WorkoutSetRateLimitError);
      expect(patch).toHaveBeenCalledTimes(1);
      expect(h.get).not.toHaveBeenCalled();
    } finally {
      await h.dispose();
    }
  });

  it('a failed canonical GET cannot confirm the uncertain outcome', async () => {
    patch.mockRejectedValue(new TypeError('response lost'));
    const h = await harness({
      read: async () => {
        throw new Error('read failed');
      },
    });
    try {
      const error = await submit(h.result);
      expect(error).toBeInstanceOf(WorkoutSetOutcomeUnknownError);
      expect((error as WorkoutSetOutcomeUnknownError).canonicalStateVerified).toBe(false);
      expect(patch).toHaveBeenCalledTimes(1);
      expect(h.get).toHaveBeenCalledTimes(1);
    } finally {
      await h.dispose();
    }
  });

  it('a lost response after sign-out cannot issue a private GET', async () => {
    patch.mockRejectedValue(new TypeError('response lost'));
    const h = await harness({ seedAccount: false });
    try {
      const error = await submit(h.result);
      expect(error).toBeInstanceOf(WorkoutSetOutcomeUnknownError);
      expect(h.get).not.toHaveBeenCalled();
      expect(patch).toHaveBeenCalledTimes(1);
    } finally {
      await h.dispose();
    }
  });

  it('offline preflight never sends PATCH or reconciliation GET', async () => {
    onlineManager.setOnline(false);
    const h = await harness();
    try {
      const error = await submit(h.result);
      expect(error).not.toBeInstanceOf(WorkoutSetOutcomeUnknownError);
      expect(patch).not.toHaveBeenCalled();
      expect(h.get).not.toHaveBeenCalled();
    } finally {
      await h.dispose();
    }
  });
});
