import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { act, cleanup, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  maxPreviousSetExercises,
  parsePreviousSets,
  previousSetExerciseIds,
  previousSetHint,
} from '@/features/workouts/lib/previous-set-hints';
import {
  previousSetsOptions,
  usePreviousSetHints,
} from '@/features/workouts/model/previous-set-hints-query';
import type { WorkoutDetails } from '@/features/workouts/model/workout-details-query';
import { accountQueryKeys } from '@/shared/api/query-client';

const exerciseId = '11111111-1111-4111-8111-111111111111';
const accountId = 'athlete-a';
const hint = { setNumber: 1, setType: 'WORKING' as const, actualReps: 8, actualWeightKg: 0 };
const history = { exerciseId, workoutCompletedAt: '2026-11-24T12:00:00.000Z', sets: [hint] };
const state = vi.hoisted(() => ({
  enabled: false,
  account: 'athlete-a',
  athlete: true,
  get: vi.fn(),
  signOut: vi.fn(),
}));
const getScopedApi = () => ({ GET: state.get }) as never;
vi.mock('@/features/auth/model/auth-context', () => ({
  useAuth: () => ({
    account: { id: state.account },
    capabilities: { athlete: state.athlete, trainer: false, admin: false },
    getScopedApi,
    signOut: state.signOut,
  }),
}));
vi.mock('@/features/app-settings/model/app-settings-context', () => ({
  useAppSettings: (select: (value: unknown) => unknown) =>
    select({ settings: { showPreviousSets: state.enabled, accountId: state.account } }),
}));

let client: QueryClient;
type Set = WorkoutDetails['exercises'][number]['sets'][number];
const pending = { status: 'PENDING', setNumber: 1, setType: 'WORKING' } as Set;
const exercise = (id = exerciseId, type = 'STRENGTH', sets = [pending]) =>
  ({ exerciseId: id, exerciseTypeSnapshot: type, sets }) as WorkoutDetails['exercises'][number];
const workout = (exercises = [exercise()], status = 'IN_PROGRESS') =>
  ({ id: 'workout-a', athleteId: accountId, status, exercises }) as WorkoutDetails;
const ok = (data = history) => ({ response: { status: 200 }, data });
const scope = () => ({
  accountId,
  workoutId: 'workout-a',
  client,
  getScopedApi,
  signOut: state.signOut,
});

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  client.mount();
  client.setQueryData(accountQueryKeys.me(accountId), { id: accountId });
  state.enabled = false;
  state.account = accountId;
  state.athlete = true;
  state.get.mockReset().mockResolvedValue(ok());
  state.signOut.mockReset().mockResolvedValue(undefined);
  onlineManager.setOnline(true);
});
afterEach(async () => {
  await cleanup();
  client.clear();
  client.unmount();
  onlineManager.setOnline(true);
});

function Probe({ data }: { data?: WorkoutDetails }) {
  const hints = usePreviousSetHints(data);
  return <Text>{hints.has(exerciseId) ? 'hint' : 'no hint'}</Text>;
}
function app(data?: WorkoutDetails) {
  return (
    <QueryClientProvider client={client}>
      <Probe data={data} />
    </QueryClientProvider>
  );
}

describe('previous sets hint policy', () => {
  it('matches only pending sets by number AND type, including zero weight', () => {
    expect(previousSetHint(history, pending)).toEqual(hint);
    expect(previousSetHint(history, { ...pending, setType: 'WARMUP' })).toBeUndefined();
    expect(previousSetHint(history, { ...pending, setNumber: 2 })).toBeUndefined();
    expect(previousSetHint(history, { ...pending, status: 'COMPLETED' })).toBeUndefined();
    expect(previousSetHint(history, { ...pending, status: 'SKIPPED' })).toBeUndefined();
  });

  it('bounds distinct strength exercise reads without expanding budget after sets finish', () => {
    const ids = Array.from({ length: 12 }, (_, n) => `exercise-${n}`);
    const exercises = [
      exercise(ids[0]),
      exercise(ids[0]),
      exercise('cardio', 'CARDIO'),
      ...ids.slice(1).map((id) => exercise(id)),
    ];
    expect(previousSetExerciseIds(workout(exercises), accountId)).toEqual(
      ids.slice(0, maxPreviousSetExercises),
    );
    exercises[0] = exercise(ids[0], 'STRENGTH', [{ ...pending, status: 'COMPLETED' }]);
    exercises[1] = exercises[0];
    expect(previousSetExerciseIds(workout(exercises), accountId)).toEqual(
      ids.slice(1, maxPreviousSetExercises),
    );
    expect(previousSetExerciseIds(workout(exercises, 'PLANNED'), accountId)).toEqual([]);
    expect(previousSetExerciseIds(workout(exercises), 'other')).toEqual([]);
  });

  it('validates identity, empty and partial results, and rejects ambiguous/invalid data', () => {
    expect(parsePreviousSets(history, exerciseId)).toEqual(history);
    expect(
      parsePreviousSets({ exerciseId, workoutCompletedAt: null, sets: [] }, exerciseId).sets,
    ).toEqual([]);
    for (const invalid of [
      { ...history, exerciseId: '22222222-2222-4222-8222-222222222222' },
      { ...history, workoutCompletedAt: null },
      { ...history, sets: [hint, hint] },
      { ...history, sets: [{ ...hint, actualReps: null, actualWeightKg: null }] },
      { ...history, sets: [{ ...hint, actualReps: 0 }] },
      { ...history, sets: [{ ...hint, actualWeightKg: -1 }] },
    ])
      expect(() => parsePreviousSets(invalid, exerciseId)).toThrow();
  });
});

describe('previous sets query lifecycle', () => {
  it('does not fetch until enabled, deduplicates and immediately hides on disable', async () => {
    const data = workout([exercise(), exercise()]);
    const view = await render(app(data));
    expect(view.getByText('no hint')).toBeTruthy();
    expect(state.get).not.toHaveBeenCalled();
    state.enabled = true;
    await view.rerender(app(data));
    await waitFor(() => expect(view.getByText('hint')).toBeTruthy());
    expect(state.get).toHaveBeenCalledExactlyOnceWith(
      '/workout-analytics/exercises/{exerciseId}/previous-sets',
      { params: { path: { exerciseId } }, signal: expect.any(AbortSignal) },
    );
    state.enabled = false;
    await view.rerender(app(data));
    expect(view.getByText('no hint')).toBeTruthy();
    expect(state.get).toHaveBeenCalledOnce();
  });

  it('does not query for planned, non-strength, foreign or unauthorized workouts', async () => {
    state.enabled = true;
    const view = await render(app(workout([exercise()], 'PLANNED')));
    await view.rerender(app(workout([exercise(exerciseId, 'CARDIO')])));
    state.account = 'other';
    await view.rerender(app(workout()));
    state.account = accountId;
    state.athlete = false;
    await view.rerender(app(workout()));
    expect(state.get).not.toHaveBeenCalled();
    expect(view.getByText('no hint')).toBeTruthy();
  });

  it('does not retry rate-limited optional history or sign out on 403/429', async () => {
    for (const status of [403, 429]) {
      state.get.mockResolvedValueOnce({ response: { status } });
      await expect(client.fetchQuery(previousSetsOptions(scope(), exerciseId))).rejects.toThrow();
      client.removeQueries({
        queryKey: accountQueryKeys.previousSets(accountId, 'workout-a', exerciseId),
      });
    }
    expect(state.get).toHaveBeenCalledTimes(2);
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it('fences late responses from a previous session with the same account ID', async () => {
    let finish!: (value: unknown) => void;
    state.get.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const query = client.fetchQuery(previousSetsOptions(scope(), exerciseId));
    const rejected = expect(query).rejects.toThrow();
    await waitFor(() => expect(state.get).toHaveBeenCalledOnce());
    client.clear();
    client.setQueryData(accountQueryKeys.me(accountId), { id: accountId });
    await act(async () => finish({ response: { status: 401 } }));
    await rejected;
    expect(state.signOut).not.toHaveBeenCalled();
    expect(
      client.getQueryData(accountQueryKeys.previousSets(accountId, 'workout-a', exerciseId)),
    ).toBeUndefined();
  });

  it('uses distinct account and workout keys and signs out on a current 401', async () => {
    expect(accountQueryKeys.previousSets(accountId, 'workout-a', exerciseId)).not.toEqual(
      accountQueryKeys.previousSets('other', 'workout-a', exerciseId),
    );
    expect(accountQueryKeys.previousSets(accountId, 'workout-a', exerciseId)).not.toEqual(
      accountQueryKeys.previousSets(accountId, 'workout-b', exerciseId),
    );
    state.get.mockResolvedValueOnce({ response: { status: 401 } });
    await expect(client.fetchQuery(previousSetsOptions(scope(), exerciseId))).rejects.toThrow();
    expect(state.signOut).toHaveBeenCalledOnce();
  });
});
