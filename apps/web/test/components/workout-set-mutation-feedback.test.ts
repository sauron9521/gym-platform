import { beforeEach, expect, test, vi } from 'vitest';

const { useMutationMock, useQueryClientMock, patchMock, authFailureMock } = vi.hoisted(() => ({
  useMutationMock: vi.fn(),
  useQueryClientMock: vi.fn(),
  patchMock: vi.fn(),
  authFailureMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: useMutationMock,
  useQueryClient: useQueryClientMock,
}));
vi.mock('@/shared/api/client', () => ({ webApi: { PATCH: patchMock } }));
vi.mock('@/shared/api/use-auth-failure', () => ({
  useAuthFailure: () => authFailureMock,
}));

import {
  useUpdateWorkoutSetMutation,
  WorkoutSetMutationError,
} from '@/features/workouts/api/workout-set-mutation';
import type { WorkoutDetailsData } from '@/features/workouts/lib/workout-details';

const persisted = {
  id: 'set-1',
  status: 'COMPLETED',
  actualReps: 8,
  actualWeightKg: '62.50',
  updatedAt: '2026-11-19T09:00:00.000Z',
};

const existing = {
  id: 'workout-1',
  exercises: [
    {
      id: 'exercise-1',
      sets: [
        { id: 'set-1', status: 'PENDING', actualReps: null },
        { id: 'set-2', status: 'COMPLETED', actualReps: 3 },
      ],
    },
    {
      id: 'exercise-2',
      sets: [{ id: 'set-3', status: 'PENDING', actualReps: null }],
    },
  ],
} as unknown as WorkoutDetailsData;

const setQueryData = vi.fn();
const invalidateQueries = vi.fn();

type MutationOptions = {
  mutationFn: (input: {
    setId: string;
    body: { status: 'COMPLETED' | 'SKIPPED' };
  }) => Promise<unknown>;
  onSuccess: (set: unknown) => Promise<void>;
  onError: (error: unknown) => void;
  retry: boolean;
};

function options() {
  return useUpdateWorkoutSetMutation('workout-1') as unknown as MutationOptions;
}

beforeEach(() => {
  vi.clearAllMocks();
  useMutationMock.mockImplementation((config) => config);
  useQueryClientMock.mockReturnValue({ setQueryData, invalidateQueries });
  invalidateQueries.mockResolvedValue(undefined);
});

test('only accepts an actual persisted matching set response', async () => {
  const config = options();
  patchMock.mockResolvedValue({
    response: { status: 200 },
    data: persisted,
  });
  const result = await config.mutationFn({ setId: 'set-1', body: { status: 'COMPLETED' } });
  expect(result).toEqual(persisted);
  expect(patchMock).toHaveBeenCalledWith('/workouts/{id}/sets/{setId}', {
    params: { path: { id: 'workout-1', setId: 'set-1' } },
    body: { status: 'COMPLETED' },
  });

  for (const data of [null, { ...persisted, id: 'another' }, { ...persisted, status: 'SKIPPED' }]) {
    patchMock.mockResolvedValueOnce({ response: { status: 200 }, data });
    await expect(
      config.mutationFn({ setId: 'set-1', body: { status: 'COMPLETED' } }),
    ).rejects.toBeInstanceOf(WorkoutSetMutationError);
  }
  patchMock.mockResolvedValueOnce({ response: { status: 429 }, data: null });
  await expect(
    config.mutationFn({ setId: 'set-1', body: { status: 'COMPLETED' } }),
  ).rejects.toMatchObject({ status: 429 });
  expect(config.retry).toBe(false);
  expect(config.onError).toBe(authFailureMock);
});

test('patches only the persisted set into current detail cache before refetch', async () => {
  const config = options();
  await config.onSuccess(persisted);
  expect(setQueryData).toHaveBeenCalledTimes(1);
  expect(setQueryData.mock.calls[0]?.[0]).toEqual(['workouts', 'detail', 'workout-1']);

  const updater = setQueryData.mock.calls[0]?.[1] as (
    value: WorkoutDetailsData | undefined,
  ) => WorkoutDetailsData | undefined;
  const updated = updater(existing)!;
  expect(updated).not.toBe(existing);
  expect(updated.exercises[0]?.sets[0]).toEqual(persisted);
  expect(updated.exercises[0]?.sets[1]).toBe(existing.exercises[0]?.sets[1]);
  expect(updated.exercises[1]?.sets[0]).toBe(existing.exercises[1]?.sets[0]);
  expect(updater(undefined)).toBeUndefined();
  expect(updater({ ...existing, exercises: [] })).toEqual({ ...existing, exercises: [] });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['workouts', 'detail', 'workout-1'],
    exact: true,
  });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['workouts', 'list'],
    refetchType: 'none',
  });
});
