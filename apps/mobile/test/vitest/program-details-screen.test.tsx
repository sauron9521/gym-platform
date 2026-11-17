import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react-native';

import {
  useCreateWorkoutFromProgram,
  useProgramAssignment,
} from '@/features/programs/model/program-assignments-query';
import { ProgramDetailsScreen } from '@/screens/programs/ui/program-details-screen';

const push = vi.fn();
const mutate = vi.fn();

vi.mock('expo-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/programs/model/program-assignments-query', () => ({
  useProgramAssignment: vi.fn(),
  useCreateWorkoutFromProgram: vi.fn(),
}));

function prepare(status: 'ACTIVE' | 'COMPLETED') {
  vi.mocked(useProgramAssignment).mockReturnValue({
    data: {
      id: 'assignment-1',
      status,
      version: {
        title: 'Програма сили',
        description: 'Програма на чотири тижні',
        workouts: [{ id: 'day-1', title: 'День 1', weekNumber: 1, dayNumber: 1 }],
      },
    },
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useProgramAssignment>);
  vi.mocked(useCreateWorkoutFromProgram).mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useCreateWorkoutFromProgram>);
}

describe('ProgramDetailsScreen native workout scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepare('ACTIVE');
  });

  it('blocks duplicate presses and navigates only after confirmed creation', async () => {
    const view = await render(<ProgramDetailsScreen id="assignment-1" />);
    const schedule = view.getByTestId('program-create-workout-day-1');
    await fireEvent.press(schedule);
    await fireEvent.press(schedule);
    expect(mutate).toHaveBeenCalledTimes(1);
    const firstCall = mutate.mock.calls[0];
    if (!firstCall) throw new Error('Expected the scheduling mutation to run');
    expect(firstCall[0]).toBe('day-1');
    expect(push).not.toHaveBeenCalled();

    const callbacks = firstCall[1];
    if (!callbacks) throw new Error('Missing scheduling callbacks');
    callbacks.onSuccess({ id: 'created-workout' });
    expect(push).toHaveBeenCalledWith({
      pathname: '/workouts/[id]',
      params: { id: 'created-workout' },
    });
  });

  it('hides mutation actions for completed assignments', async () => {
    prepare('COMPLETED');
    const view = await render(<ProgramDetailsScreen id="assignment-1" />);
    expect(view.queryByTestId('program-create-workout-day-1')).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });
});
