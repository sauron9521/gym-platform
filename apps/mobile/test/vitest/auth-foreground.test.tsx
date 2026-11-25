import type { PropsWithChildren } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from '@/features/auth/model/auth-context';
import { accountQueryKeys, createMobileQueryClient } from '@/shared/api/query-client';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  createMobileApi: () => ({ GET: mocks.get, POST: mocks.post }),
}));
vi.mock('@/features/auth/model/refresh-token-store', () => ({
  refreshTokenStore: { read: mocks.read, write: mocks.write, remove: mocks.remove },
}));

const account = { id: 'athlete-a', role: 'ATHLETE' };
const grants = { athlete: true, trainer: false, admin: false };
const ok = (data: unknown) => ({ response: { status: 200 }, data });

function deferred() {
  let resolve: (value: ReturnType<typeof ok>) => void = () => undefined;
  const promise = new Promise<ReturnType<typeof ok>>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function harness() {
  let change: ((state: AppStateStatus) => void) | undefined;
  vi.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    change = listener;
    return {
      remove: () => {
        change = undefined;
      },
    };
  });
  const client = createMobileQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  const hook = await renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(hook.result.current.restoring).toBe(false));
  await act(async () => {
    expect(await hook.result.current.signIn('athlete@example.test', 'secret')).toEqual({
      success: true,
    });
  });
  expect(hook.result.current.capabilities).toEqual(grants);
  return {
    ...hook,
    client,
    async emit(state: AppStateStatus) {
      await act(async () => {
        expect(change).toBeDefined();
        change?.(state);
      });
    },
    async dispose() {
      await hook.unmount();
      client.clear();
    },
  };
}

describe('auth foreground account-cache lifecycle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://staging.example.test');
    mocks.read.mockResolvedValue(null);
    mocks.write.mockResolvedValue(undefined);
    mocks.remove.mockResolvedValue(undefined);
    mocks.get.mockImplementation(async (path: string) =>
      ok(path === '/users/me' ? account : grants),
    );
    mocks.post.mockResolvedValue(
      ok({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 900,
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('restores only the current account marker after live grants verify on resume', async () => {
    const h = await harness();
    const key = accountQueryKeys.me(account.id);
    const workoutKey = accountQueryKeys.workoutDetail(account.id, 'workout-a');
    try {
      h.client.setQueryData(workoutKey, { status: 'PENDING' });
      await h.emit('background');
      expect(h.result.current.capabilities).toBeNull();
      expect(h.client.getQueryData(key)).toBeUndefined();
      expect(h.client.getQueryData(workoutKey)).toBeUndefined();

      const check = deferred();
      mocks.get.mockReturnValueOnce(check.promise);
      await h.emit('active');
      expect(h.client.getQueryData(key)).toBeUndefined();
      expect(h.result.current.capabilities).toBeNull();

      await act(async () => check.resolve(ok(grants)));
      await waitFor(() => expect(h.result.current.capabilities).toEqual(grants));
      expect(h.client.getQueryData(key)).toEqual(account);
      expect(h.client.getQueryState(key)?.dataUpdatedAt).toBe(0);
      expect(h.client.getQueryData(workoutKey)).toBeUndefined();
      expect(h.client.getQueryData(accountQueryKeys.me('other-account'))).toBeUndefined();
      expect(mocks.get.mock.calls.map(([path]) => path)).toEqual([
        '/users/me',
        '/users/me/capabilities',
        '/users/me/capabilities',
      ]);
    } finally {
      await h.dispose();
    }
  });

  it('does not restore an account marker from an obsolete foreground check', async () => {
    const h = await harness();
    const key = accountQueryKeys.me(account.id);
    try {
      await h.emit('background');
      const check = deferred();
      mocks.get.mockReturnValueOnce(check.promise);
      await h.emit('active');
      await h.emit('background');
      await act(async () => check.resolve(ok(grants)));
      expect(h.client.getQueryData(key)).toBeUndefined();
      expect(h.result.current.capabilities).toBeNull();
    } finally {
      await h.dispose();
    }
  });

  it('does not restore private cache after logout during a pending foreground check', async () => {
    const h = await harness();
    try {
      await h.emit('background');
      const check = deferred();
      mocks.get.mockReturnValueOnce(check.promise);
      await h.emit('active');
      await act(async () => h.result.current.signOut());
      await act(async () => check.resolve(ok(grants)));
      expect(h.result.current.account).toBeNull();
      expect(h.result.current.capabilities).toBeNull();
      expect(h.client.getQueryCache().getAll()).toHaveLength(0);
    } finally {
      await h.dispose();
    }
  });

  it('keeps the cache locked after a failed grant verification', async () => {
    const h = await harness();
    try {
      await h.emit('background');
      mocks.get.mockResolvedValueOnce({ response: { status: 503 } });
      await h.emit('active');
      await waitFor(() => expect(h.result.current.recoveryAvailable).toBe(true));
      expect(h.result.current.account).toBeNull();
      expect(h.result.current.capabilities).toBeNull();
      expect(h.client.getQueryCache().getAll()).toHaveLength(0);
    } finally {
      await h.dispose();
    }
  });
  it('revokes local access when foreground grants explicitly deny mobile access', async () => {
    const h = await harness();
    try {
      await h.emit('inactive');
      mocks.get.mockResolvedValueOnce(ok({ athlete: false, trainer: false, admin: true }));
      await h.emit('active');
      await waitFor(() => expect(h.result.current.account).toBeNull());
      expect(h.result.current.capabilities).toBeNull();
      expect(h.result.current.recoveryAvailable).toBe(false);
      expect(h.client.getQueryCache().getAll()).toHaveLength(0);
      expect(mocks.remove).toHaveBeenCalled();
    } finally {
      await h.dispose();
    }
  });

  it('keeps startup locked until live grants confirm access after token rotation', async () => {
    mocks.read.mockResolvedValueOnce('stored-refresh');
    const pending = deferred();
    mocks.get.mockResolvedValueOnce(ok(account)).mockReturnValueOnce(pending.promise);
    const client = createMobileQueryClient();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
    const hook = await renderHook(() => useAuth(), { wrapper });
    try {
      await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/users/me/capabilities'));
      expect(hook.result.current.restoring).toBe(true);
      expect(hook.result.current.account).toBeNull();
      expect(hook.result.current.capabilities).toBeNull();
      expect(client.getQueryData(accountQueryKeys.me(account.id))).toBeUndefined();
      await act(async () => pending.resolve(ok(grants)));
      await waitFor(() => expect(hook.result.current.restoring).toBe(false));
      expect(hook.result.current.account).toEqual(account);
      expect(hook.result.current.capabilities).toEqual(grants);
      expect(client.getQueryData(accountQueryKeys.me(account.id))).toEqual(account);
      expect(mocks.post.mock.calls.map(([path]) => path)).toEqual(['/auth/token/refresh']);
    } finally {
      await hook.unmount();
      client.clear();
    }
  });

  it('retries a transient startup verification failure without replaying refresh', async () => {
    mocks.read.mockResolvedValueOnce('stored-refresh');
    mocks.get.mockResolvedValueOnce({ response: { status: 503 } });
    const client = createMobileQueryClient();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
    const hook = await renderHook(() => useAuth(), { wrapper });
    try {
      await waitFor(() => expect(hook.result.current.restoring).toBe(false));
      expect(hook.result.current.recoveryAvailable).toBe(true);
      expect(hook.result.current.account).toBeNull();
      expect(hook.result.current.capabilities).toBeNull();
      await act(async () => {
        expect(await hook.result.current.retryVerification()).toEqual({ success: true });
      });
      expect(hook.result.current.account).toEqual(account);
      expect(hook.result.current.capabilities).toEqual(grants);
      expect(hook.result.current.recoveryAvailable).toBe(false);
      expect(mocks.post.mock.calls.map(([path]) => path)).toEqual(['/auth/token/refresh']);
    } finally {
      await hook.unmount();
      client.clear();
    }
  });
});
