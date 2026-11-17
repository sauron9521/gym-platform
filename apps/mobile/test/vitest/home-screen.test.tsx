import { fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/features/auth/model/auth-context';
import { useProgramAssignments } from '@/features/programs/model/program-assignments-query';
import { useWorkoutSummary } from '@/features/progress/model/workout-summary-query';
import { useWorkoutsQuery } from '@/features/workouts/model/workouts-query';
import { HomeScreen } from '@/screens/home/ui/home-screen';

const push = vi.hoisted(() => vi.fn());
vi.mock('expo-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/features/programs/model/program-assignments-query', () => ({
  useProgramAssignments: vi.fn(),
}));
vi.mock('@/features/progress/model/workout-summary-query', () => ({
  useWorkoutSummary: vi.fn(),
}));
vi.mock('@/features/workouts/model/workouts-query', () => ({
  useWorkoutsQuery: vi.fn(),
}));

const refetchWorkouts = vi.fn();
const refetchSummary = vi.fn();
const refetchPrograms = vi.fn();

function setAccount(role: 'ATHLETE' | 'TRAINER') {
  vi.mocked(useAuth).mockReturnValue({
    account: {
      id: 'account-1',
      role,
      profile: { displayName: 'Олена' },
    },
  } as unknown as ReturnType<typeof useAuth>);
}

function prepareAthlete() {
  setAccount('ATHLETE');
  vi.mocked(useWorkoutSummary).mockReturnValue({
    data: { workoutCount: 2 },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: refetchSummary,
  } as unknown as ReturnType<typeof useWorkoutSummary>);
  vi.mocked(useProgramAssignments).mockReturnValue({
    data: { pages: [{ data: [], meta: { total: 23 } }] },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: refetchPrograms,
  } as unknown as ReturnType<typeof useProgramAssignments>);
  vi.mocked(useWorkoutsQuery).mockReturnValue({
    data: {
      pages: [{ data: [{ id: 'workout-1', title: 'Тренування A', status: 'PLANNED' }] }],
    },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: refetchWorkouts,
  } as unknown as ReturnType<typeof useWorkoutsQuery>);
}

describe('HomeScreen real athlete dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareAthlete();
  });

  it('renders API-derived totals and routes to an individual workout', async () => {
    const view = await render(<HomeScreen />);
    expect(useWorkoutSummary).toHaveBeenCalledWith('7d');
    expect(view.getByText('2')).toBeTruthy();
    expect(view.getByText('23')).toBeTruthy();
    expect(view.getByText('Тренування A')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Відкрити тренування Тренування A' }));
    expect(push).toHaveBeenCalledWith({
      pathname: '/workouts/[id]',
      params: { id: 'workout-1' },
    });
    await fireEvent.press(view.getByTestId('home-create-workout'));
    expect(push).toHaveBeenCalledWith('/workouts/new');
  });

  it('does not invoke athlete-only API queries or actions for trainers', async () => {
    setAccount('TRAINER');
    const view = await render(<HomeScreen />);
    expect(useWorkoutsQuery).not.toHaveBeenCalled();
    expect(useProgramAssignments).not.toHaveBeenCalled();
    expect(useWorkoutSummary).not.toHaveBeenCalled();
    expect(view.queryByTestId('home-create-workout')).toBeNull();
    expect(view.queryByTestId('home-progress')).toBeNull();
    await fireEvent.press(view.getByTestId('home-profile'));
    expect(push).toHaveBeenCalledWith('/profile');
  });

  it('exposes an accessible retry after a failed workout read', async () => {
    vi.mocked(useWorkoutsQuery).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Помилка API'),
      isFetching: false,
      refetch: refetchWorkouts,
    } as unknown as ReturnType<typeof useWorkoutsQuery>);
    const view = await render(<HomeScreen />);
    expect(view.getByText('Помилка API')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Спробувати ще раз' }));
    expect(refetchWorkouts).toHaveBeenCalledOnce();
    expect(view.queryByText('Тренування A')).toBeNull();
  });

  it('shows empty workout state without inventing history', async () => {
    vi.mocked(useWorkoutsQuery).mockReturnValue({
      data: { pages: [{ data: [] }] },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: refetchWorkouts,
    } as unknown as ReturnType<typeof useWorkoutsQuery>);
    const view = await render(<HomeScreen />);
    expect(view.getByText('Тренувань ще немає. Створіть перше!')).toBeTruthy();
  });
});
