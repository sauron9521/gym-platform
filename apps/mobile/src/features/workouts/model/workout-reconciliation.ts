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
