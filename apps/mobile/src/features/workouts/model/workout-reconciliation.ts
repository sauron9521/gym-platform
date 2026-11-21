import { focusManager, onlineManager, type QueryClient } from '@tanstack/react-query';

import { accountQueryKeys } from '../../../shared/api/query-client';

/** Read-only canonical refresh on screen focus. No mutation is retried or replayed. */
export async function reconcileWorkoutOnFocus(
  queryClient: QueryClient,
  accountId: string | null,
  workoutId: string,
) {
  if (!accountId || !workoutId || !focusManager.isFocused() || !onlineManager.isOnline()) {
    return;
  }
  // Authentication is authoritative. Do not request data after sign-out/cache clear.
  if (!queryClient.getQueryData(accountQueryKeys.me(accountId))) return;

  // Invalidate only the currently viewed workout. If its GET is already in
  // flight, join it rather than cancel/restart the request on initial focus.
  await queryClient.invalidateQueries(
    { queryKey: accountQueryKeys.workoutDetail(accountId, workoutId), exact: true },
    { cancelRefetch: false },
  );
}

/**
 * A transport failure after PATCH does not mean a failed write. Mark the
 * account-scoped GET stale and, if its screen is mounted and online, read the
 * canonical result once. Never call the PATCH endpoint or enqueue a mutation.
 *
 * Returns true only after a newer, successful canonical GET. If the device is
 * offline or the GET fails, the query stays invalid for focus/reconnect retry.
 */
export async function reconcileWorkoutAfterUncertainWrite(
  queryClient: QueryClient,
  accountId: string | null,
  workoutId: string,
): Promise<boolean> {
  if (!accountId || !workoutId || !queryClient.getQueryData(accountQueryKeys.me(accountId))) {
    return false;
  }

  const queryKey = accountQueryKeys.workoutDetail(accountId, workoutId);
  await queryClient.cancelQueries({ queryKey, exact: true });
  if (!queryClient.getQueryData(accountQueryKeys.me(accountId))) return false;

  await queryClient.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
  if (
    !onlineManager.isOnline() ||
    !queryClient.getQueryCache().find({ queryKey, exact: true })?.isActive()
  ) {
    return false;
  }

  const readKey = accountQueryKeys.workoutDetailRead(accountId, workoutId);
  const before = queryClient.getQueryData<number>(readKey) ?? 0;
  try {
    await queryClient.refetchQueries(
      { queryKey, exact: true, type: 'active' },
      { cancelRefetch: false, throwOnError: true },
    );
  } catch {
    // An unsuccessful GET is *not* evidence that the PATCH was rejected.
    return false;
  }
  if (!queryClient.getQueryData(accountQueryKeys.me(accountId))) return false;
  const state = queryClient.getQueryState(queryKey);
  return state?.status === 'success' && (queryClient.getQueryData<number>(readKey) ?? 0) > before;
}
