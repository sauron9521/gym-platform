import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useExercisesQuery } from '@/features/exercises/model/exercises-query';
import { useCreateMultiMobileWorkout } from '@/features/workouts/model/workout-create';
import { CreateWorkoutScreen } from '@/screens/workouts/ui/create-workout-screen';

const back = vi.hoisted(() => vi.fn());

vi.mock('expo-router', () => ({ useRouter: () => ({ back }) }));
vi.mock('@/features/exercises/model/exercises-query', () => ({
  useExercisesQuery: vi.fn(),
}));
vi.mock('@/features/workouts/model/workout-create', () => ({
  useCreateMultiMobileWorkout: vi.fn(),
}));

const mutateAsync = vi.fn();
const exerciseId = '11111111-1111-4111-8111-111111111111';

function prepare() {
  vi.mocked(useExercisesQuery).mockReturnValue({
    data: {
      pages: [{ data: [{ id: exerciseId, name: 'Жим лежачи', isArchived: false }] }],
    },
    isPending: false,
    isError: false,
    isFetching: false,
    hasNextPage: false,
  } as unknown as ReturnType<typeof useExercisesQuery>);

  vi.mocked(useCreateMultiMobileWorkout).mockReturnValue({
    mutateAsync,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useCreateMultiMobileWorkout>);
}

describe('Multi-exercise CreateWorkoutScreen (native)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue('workout-created');
    prepare();
  });

  it('adds and removes nested exercises and sets without deleting the final item', async () => {
    const view = await render(<CreateWorkoutScreen />);

    expect(view.getByRole('button', { name: 'Видалити вправу 1', disabled: true })).toBeTruthy();
    expect(
      view.getByRole('button', { name: 'Прибрати підхід 1 вправи 1', disabled: true }),
    ).toBeTruthy();

    await fireEvent.press(view.getByTestId('workout-set-add-0'));
    expect(view.getByText('Підхід 2')).toBeTruthy();

    await fireEvent.press(view.getByTestId('workout-set-remove-0-1'));
    expect(view.queryByText('Підхід 2')).toBeNull();

    await fireEvent.press(view.getByTestId('workout-exercise-add'));
    expect(view.getByText('Вправа 2')).toBeTruthy();

    await fireEvent.press(view.getByTestId('workout-exercise-remove-1'));
    expect(view.queryByText('Вправа 2')).toBeNull();
  });

  it('submits validated nested form data and navigates only on mutation success', async () => {
    const view = await render(<CreateWorkoutScreen />);

    await fireEvent.changeText(view.getByLabelText('Назва тренування'), 'Спина');
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    await fireEvent.press(view.getByRole('button', { name: 'Жим лежачи' }));
    await fireEvent.changeText(view.getByLabelText('Планова вага, вправа 1, підхід 1'), '62,5');
    await fireEvent.press(view.getByTestId('workout-set-add-0'));
    await fireEvent.changeText(view.getByLabelText('Повторення, вправа 1, підхід 2'), '8');
    await fireEvent.press(view.getByTestId('create-workout-submit'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(mutateAsync).toHaveBeenCalledWith({
      title: 'Спина',
      exercises: [
        {
          exerciseId,
          sets: [
            { reps: '10', weightKg: '62,5' },
            { reps: '8', weightKg: '' },
          ],
        },
      ],
    });
    await waitFor(() => expect(back).toHaveBeenCalledOnce());
  });

  it('keeps the form open on a failed POST and does not navigate', async () => {
    mutateAsync.mockRejectedValueOnce(new Error('Мережа недоступна'));
    const view = await render(<CreateWorkoutScreen />);

    await fireEvent.changeText(view.getByLabelText('Назва тренування'), 'Спина');
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    await fireEvent.press(view.getByRole('button', { name: 'Жим лежачи' }));
    await fireEvent.press(view.getByTestId('create-workout-submit'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(back).not.toHaveBeenCalled();
  });
  it('blocks repeat submission while pending and preserves nested values for a manual retry after failure', async () => {
    let reject: (error: Error) => void = () => undefined;
    mutateAsync.mockReturnValueOnce(
      new Promise<string>((_resolve, fail) => {
        reject = fail;
      }),
    );
    const view = await render(<CreateWorkoutScreen />);
    await fireEvent.changeText(view.getByLabelText('Назва тренування'), 'Груди');
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    await fireEvent.press(view.getByRole('button', { name: 'Жим лежачи' }));
    await fireEvent.changeText(view.getByLabelText('Планова вага, вправа 1, підхід 1'), '65');
    await fireEvent.press(view.getByTestId('create-workout-submit'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(view.getByTestId('create-workout-submit').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByTestId('create-workout-submit'));
    expect(mutateAsync).toHaveBeenCalledOnce();
    expect(back).not.toHaveBeenCalled();
    await act(async () => reject(new Error('Lost response')));
    await waitFor(() =>
      expect(view.getByTestId('create-workout-submit').props.accessibilityState.disabled).toBe(
        false,
      ),
    );
    expect(view.getByLabelText('Назва тренування').props.value).toBe('Груди');
    expect(view.getByLabelText('Планова вага, вправа 1, підхід 1').props.value).toBe('65');
    await fireEvent.press(view.getByTestId('create-workout-submit'));
    await waitFor(() => expect(back).toHaveBeenCalledOnce());
    expect(mutateAsync).toHaveBeenCalledTimes(2);
    expect(mutateAsync.mock.calls[1]?.[0]).toEqual(mutateAsync.mock.calls[0]?.[0]);
  });
});
