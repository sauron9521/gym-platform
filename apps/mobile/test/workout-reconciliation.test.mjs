import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { QueryObserver, focusManager, onlineManager } from '@tanstack/react-query';

import { accountQueryKeys, createMobileQueryClient } from '../src/shared/api/query-client.ts';
import { reconcileWorkoutOnFocus } from '../src/features/workouts/model/workout-reconciliation.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

function freshClient(accountId = 'athlete') {
  const client = createMobileQueryClient();
  client.setQueryData(accountQueryKeys.me(accountId), { id: accountId });
  return client;
}

async function withFocus(fn) {
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
  try {
    return await fn();
  } finally {
    focusManager.setFocused(undefined);
    onlineManager.setOnline(true);
  }
}

test('screen focus refreshes only the active account/workout GET, never a mutation', async () =>
  withFocus(async () => {
    const client = freshClient();
    const key = accountQueryKeys.workoutDetail('athlete', 'workout-a');
    const otherKey = accountQueryKeys.workoutDetail('athlete', 'workout-b');
    client.setQueryData(key, { setStatus: 'PENDING' });
    client.setQueryData(otherKey, { setStatus: 'PENDING' });
    let requested = 0;
    let unrelatedReads = 0;
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn: async () => {
        requested += 1;
        return { setStatus: 'COMPLETED' };
      },
      staleTime: Infinity,
    });
    const unrelated = new QueryObserver(client, {
      queryKey: otherKey,
      queryFn: async () => {
        unrelatedReads += 1;
        return { setStatus: 'SKIPPED' };
      },
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    const unsubscribeOther = unrelated.subscribe(() => undefined);
    try {
      await reconcileWorkoutOnFocus(client, 'athlete', 'workout-a');
      assert.equal(requested, 1);
      assert.equal(unrelatedReads, 0);
      assert.equal(client.getQueryData(key).setStatus, 'COMPLETED');
      assert.equal(client.getQueryData(otherKey).setStatus, 'PENDING');
    } finally {
      unsubscribe();
      unsubscribeOther();
      client.clear();
    }
  }));

test('sign-out, background, offline and missing IDs cannot trigger a private GET', async () =>
  withFocus(async () => {
    const client = freshClient();
    const key = accountQueryKeys.workoutDetail('athlete', 'workout-a');
    client.setQueryData(key, { setStatus: 'PENDING' });
    let requests = 0;
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn: async () => {
        requests += 1;
        return { setStatus: 'COMPLETED' };
      },
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    try {
      onlineManager.setOnline(false);
      await reconcileWorkoutOnFocus(client, 'athlete', 'workout-a');
      onlineManager.setOnline(true);
      focusManager.setFocused(false);
      await reconcileWorkoutOnFocus(client, 'athlete', 'workout-a');
      focusManager.setFocused(true);
      await reconcileWorkoutOnFocus(client, null, 'workout-a');
      await reconcileWorkoutOnFocus(client, 'athlete', '');
      client.removeQueries({ queryKey: accountQueryKeys.me('athlete') });
      await reconcileWorkoutOnFocus(client, 'athlete', 'workout-a');
      assert.equal(requests, 0);
    } finally {
      unsubscribe();
      client.clear();
    }
  }));

test('native foreground refetches even inside the 30-second stale cache window', () => {
  const query = read('../src/features/workouts/model/workout-details-query.ts');
  const provider = read('../src/shared/api/query-provider.tsx');
  assert.match(query, /refetchOnWindowFocus: 'always'/);
  assert.match(query, /refetchOnReconnect: 'always'/);
  assert.match(provider, /focusManager\.setFocused\(state === 'active'\)/);
  assert.match(query, /useFocusEffect\(/);
  assert.doesNotMatch(query, /api\.PATCH/);
});
