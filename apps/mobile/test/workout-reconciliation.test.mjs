import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { QueryObserver, focusManager, onlineManager } from '@tanstack/react-query';

import { accountQueryKeys, createMobileQueryClient } from '../src/shared/api/query-client.ts';
import {
  reconcileWorkoutOnFocus,
  reconcileWorkoutAfterUncertainWrite,
} from '../src/features/workouts/model/workout-reconciliation.ts';

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

test('unknown PATCH outcome triggers only one account-scoped canonical GET', async () =>
  withFocus(async () => {
    const client = freshClient();
    const key = accountQueryKeys.workoutDetail('athlete', 'workout-a');
    const otherKey = accountQueryKeys.workoutDetail('athlete', 'workout-b');
    client.setQueryData(key, { status: 'PENDING' });
    client.setQueryData(otherKey, { status: 'PENDING' });
    let getCount = 0;
    let unrelatedCount = 0;
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn: async () => {
        getCount += 1;
        client.setQueryData(
          accountQueryKeys.workoutDetailRead('athlete', 'workout-a'),
          (previous = 0) => previous + 1,
        );
        return { status: 'COMPLETED' };
      },
      staleTime: Infinity,
    });
    const other = new QueryObserver(client, {
      queryKey: otherKey,
      queryFn: async () => {
        unrelatedCount += 1;
        return { status: 'SKIPPED' };
      },
      staleTime: Infinity,
    });
    const unsub = observer.subscribe(() => undefined);
    const otherUnsub = other.subscribe(() => undefined);
    try {
      // A distinct update timestamp is required to confirm a new GET (not stale data).
      await new Promise((resolve) => setTimeout(resolve, 4));
      assert.equal(await reconcileWorkoutAfterUncertainWrite(client, 'athlete', 'workout-a'), true);
      assert.equal(getCount, 1);
      assert.equal(unrelatedCount, 0);
      assert.equal(client.getQueryData(key).status, 'COMPLETED');
      assert.equal(client.getQueryData(otherKey).status, 'PENDING');
    } finally {
      unsub();
      otherUnsub();
      client.clear();
    }
  }));

test('offline, inactive queries or signed-out account never perform a verification GET', async () =>
  withFocus(async () => {
    const client = freshClient();
    const key = accountQueryKeys.workoutDetail('athlete', 'workout-a');
    client.setQueryData(key, { status: 'PENDING' });
    let gets = 0;
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn: async () => {
        gets += 1;
        return { status: 'COMPLETED' };
      },
      staleTime: Infinity,
    });
    try {
      onlineManager.setOnline(false);
      assert.equal(
        await reconcileWorkoutAfterUncertainWrite(client, 'athlete', 'workout-a'),
        false,
      );
      // No active observer means no read is initiated by the reconciliation helper.
      onlineManager.setOnline(true);
      assert.equal(
        await reconcileWorkoutAfterUncertainWrite(client, 'athlete', 'workout-a'),
        false,
      );
      assert.equal(gets, 0);
      // Subscribing to a previously invalidated query can itself start GET.
      // Count that unrelated mount fetch before testing sign-out protection.
      const unsub = observer.subscribe(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 2));
      const beforeSignout = gets;
      client.removeQueries({ queryKey: accountQueryKeys.me('athlete') });
      assert.equal(
        await reconcileWorkoutAfterUncertainWrite(client, 'athlete', 'workout-a'),
        false,
      );
      assert.equal(gets, beforeSignout);
      unsub();
    } finally {
      client.clear();
    }
  }));

test('failed verification GET never falsely confirms an unknown write', async () =>
  withFocus(async () => {
    const client = freshClient();
    const key = accountQueryKeys.workoutDetail('athlete', 'workout-a');
    client.setQueryData(key, { status: 'PENDING' });
    let requests = 0;
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn: async () => {
        requests += 1;
        throw new Error('read temporarily unavailable');
      },
      retry: false,
      staleTime: Infinity,
    });
    const unsub = observer.subscribe(() => undefined);
    try {
      assert.equal(
        await reconcileWorkoutAfterUncertainWrite(client, 'athlete', 'workout-a'),
        false,
      );
      assert.equal(requests, 1);
    } finally {
      unsub();
      client.clear();
    }
  }));
