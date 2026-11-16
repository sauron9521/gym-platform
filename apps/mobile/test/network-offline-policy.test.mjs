import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import { isConnectionAvailable } from '../src/shared/api/network-state.ts';

test('network unknown does not falsely classify a connection as disconnected', () => {
  assert.equal(isConnectionAvailable({}), true);
  assert.equal(isConnectionAvailable({ isConnected: true, isInternetReachable: undefined }), true);
  assert.equal(isConnectionAvailable({ isConnected: false }), false);
  assert.equal(isConnectionAvailable({ isInternetReachable: false }), false);
});

test('native online manager pauses reads while mutations never replay after reconnect', () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const provider = read('../src/shared/api/query-provider.tsx');
  const sets = read('../src/features/workouts/model/workout-set-mutation.ts');
  const programs = read('../src/features/programs/model/program-assignments-query.ts');
  const transitions = read('../src/features/workouts/model/workout-details-query.ts');
  const profile = read('../src/features/profile/model/edit-profile-mutation.ts');
  const packageJson = JSON.parse(read('../package.json'));

  assert.equal(packageJson.dependencies['expo-network'], '~58.0.5');
  assert.equal(packageJson.dependencies['expo-haptics'], '~58.0.8');
  assert.match(provider, /Network\.addNetworkStateListener/);
  assert.match(provider, /onlineManager\.setOnline/);
  assert.match(sets, /Haptics\.notificationAsync/);
  for (const source of [sets, programs, transitions, profile]) {
    assert.match(source, /networkMode: 'always'/);
    assert.match(source, /!onlineManager\.isOnline\(\)/);
  }
});
