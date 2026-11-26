import type { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureWorkoutCompletionGuard,
  useWorkoutTransition,
  type WorkoutDetails,
} from '@/features/workouts/model/workout-details-query';
import { useAuth } from '@/features/auth/model/auth-context';
import { accountQueryKeys } from '@/shared/api/query-client';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
const accountId = 'athlete-a';
const workoutId = 'workout-a';
const markerKey = accountQueryKeys.me(accountId);
const detailKey = accountQueryKeys.workoutDetail(accountId, workoutId);
const readKey = accountQueryKeys.workoutDetailRead(accountId, workoutId);
const post = vi.fn();
const signOut = vi.fn();
let client: QueryClient;
let snapshot: WorkoutDetails;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  snapshot = {
    id: workoutId,
    athleteId: accountId,
    status: 'IN_PROGRESS',
    exercises: [],
  } as unknown as WorkoutDetails;
  client.setQueryData(markerKey, { id: accountId });
  client.setQueryData(detailKey, snapshot, { updatedAt: 100 });
  client.setQueryData(readKey, 5);
  onlineManager.setOnline(true);
  post.mockReset();
  signOut.mockReset().mockResolvedValue(undefined);
  vi.mocked(useAuth).mockReturnValue({
    account: { id: accountId },
    getScopedApi: (current: () => boolean) => (current() ? { POST: post } : null),
    signOut,
  } as unknown as ReturnType<typeof useAuth>);
});
afterEach(() => {
  client.clear();
  onlineManager.setOnline(true);
});

const guard = () => captureWorkoutCompletionGuard(client, accountId, workoutId, snapshot, 100);

describe('workout completion snapshot proof', () => {
  it('requires the same verified account, exact snapshot, and canonical read version', () => {
    const proof = guard();
    expect(proof()).toBe(true);
    expect(captureWorkoutCompletionGuard(client, 'other', workoutId, snapshot, 100)()).toBe(false);
    expect(captureWorkoutCompletionGuard(client, accountId, 'other', snapshot, 100)()).toBe(false);
    client.setQueryData(readKey, 6);
    expect(proof()).toBe(false);
  });

  it('rejects changed snapshots and failed or in-flight revalidation', async () => {
    const proof = guard();
    const entry = client.getQueryCache().find({ queryKey: detailKey, exact: true })!;
    entry.setState({ fetchStatus: 'fetching' });
    expect(proof()).toBe(false);
    entry.setState({ fetchStatus: 'idle', status: 'error' });
    expect(proof()).toBe(false);
    entry.setState({ status: 'success' });
    client.setQueryData(detailKey, { ...snapshot, status: 'COMPLETED' });
    expect(proof()).toBe(false);
  });

  it('rejects old consent even when the same account signs in with identical data', () => {
    const proof = guard();
    client.clear();
    client.setQueryData(markerKey, { id: accountId });
    client.setQueryData(detailKey, snapshot, { updatedAt: 100 });
    client.setQueryData(readKey, 5);
    expect(proof()).toBe(false);
    expect(guard()()).toBe(true);
  });
});

async function mountTransition() {
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useWorkoutTransition(workoutId), { wrapper });
}

describe('workout transition session fencing', () => {
  it('updates only the current account after an acknowledged completion', async () => {
    const done = { ...snapshot, status: 'COMPLETED' };
    post.mockResolvedValue({ response: { status: 200 }, data: done });
    const view = await mountTransition();
    await act(async () => view.result.current.mutate('complete'));
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    expect(post).toHaveBeenCalledExactlyOnceWith('/workouts/{id}/complete', {
      params: { path: { id: workoutId } },
    });
    expect(client.getQueryData(detailKey)).toEqual(done);
    await view.unmount();
  });

  it('does not send completion after the reviewed snapshot is invalidated before dispatch', async () => {
    const proof = guard();
    const view = await mountTransition();
    client.setQueryData(readKey, 6);
    await act(async () => view.result.current.mutate('complete', { canSend: proof }));
    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(post).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('does not restore a stale receipt or sign out a replacement session', async () => {
    const view = await mountTransition();
    let finish!: (result: unknown) => void;
    post.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await act(async () => view.result.current.mutate('complete'));
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    client.clear();
    client.setQueryData(markerKey, { id: accountId });
    client.setQueryData(detailKey, snapshot);
    await view.rerender(undefined);
    await act(async () => finish({ response: { status: 401 } }));
    expect(signOut).not.toHaveBeenCalled();
    expect(client.getQueryData(detailKey)).toEqual(snapshot);
    await view.unmount();
  });

  it('rejects a late old-scope successful receipt and never sends offline requests', async () => {
    const view = await mountTransition();
    let finish!: (result: unknown) => void;
    post.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await act(async () => view.result.current.mutate('complete'));
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    client.clear();
    client.setQueryData(markerKey, { id: accountId });
    client.setQueryData(detailKey, snapshot);
    await view.rerender(undefined);
    await act(async () =>
      finish({ response: { status: 200 }, data: { ...snapshot, status: 'COMPLETED' } }),
    );
    expect(client.getQueryData(detailKey)).toEqual(snapshot);
    await view.unmount();

    const next = await mountTransition();
    onlineManager.setOnline(false);
    await act(async () => next.result.current.mutate('complete'));
    await waitFor(() => expect(next.result.current.isError).toBe(true));
    expect(post).toHaveBeenCalledOnce();
    onlineManager.setOnline(true);
    expect(post).toHaveBeenCalledOnce();
    await next.unmount();
  });
});
