import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react-native';

import { useAuth } from '@/features/auth/model/auth-context';
import { useProgramAssignments } from '@/features/programs/model/program-assignments-query';
import { useWorkoutSummary } from '@/features/progress/model/workout-summary-query';
import { useWorkoutsQuery } from '@/features/workouts/model/workouts-query';
import { HomeScreen } from '@/screens/home/ui/home-screen';

const push = vi.fn();
const refetch = vi.fn();
vi.mock('expo-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/features/programs/model/program-assignments-query', () => ({ useProgramAssignments: vi.fn() }));
vi.mock('@/features/progress/model/workout-summary-query', () => ({ useWorkoutSummary: vi.fn() }));
vi.mock('@/features/workouts/model/workouts-query', () => ({ useWorkoutsQuery: vi.fn() }));

function prepare(role: 'ATHLETE' | 'TRAINER', failed = false) {
  vi.mocked(useAuth).mockReturnValue({ account: { id: 'user-1', role, profile: { firstName: 'Тест' } } } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(useWorkoutsQuery).mockReturnValue({
    isPending: false, isError: failed, error: new Error('Немає мережі'), refetch,
    data: { pages: [{ data: [{ id: 'w-1', title: 'Тренування А', status: 'COMPLETED' }] }] },
  } as unknown as ReturnType<typeof useWorkoutsQuery>);
  vi.mocked(useProgramAssignments).mockReturnValue({
    isPending: false, isError: false, data: { data: [{ id: 'p-1' }] },
  } as unknown as ReturnType<typeof useProgramAssignments>);
  vi.mocked(useWorkoutSummary).mockReturnValue({
    isPending: false, isError: false, data: { workoutCount: 3 },
  } as unknown as ReturnType<typeof useWorkoutSummary>);
}

describe('HomeScreen (real native renderer)', () => {
  beforeEach(() => { vi.clearAllMocks(); prepare('ATHLETE'); });

  it('shows real athlete metrics and navigates to a specific workout', async () => {
    const view = await render(<HomeScreen />);
    expect(view.getByText('Тренування А')).toBeTruthy();
    expect(view.getByText('Тренувань за 7 днів')).toBeTruthy();
    await fireEvent.press(view.getByText('Тренування А'));
    expect(push).toHaveBeenCalledWith({ pathname: '/workouts/[id]', params: { id: 'w-1' } });
  });

  it('does not render athlete-only actions or metrics for trainers', async () => {
    prepare('TRAINER');
    const view = await render(<HomeScreen />);
    expect(view.queryByText('Створити тренування')).toBeNull();
    expect(view.queryByText('Тренувань за 7 днів')).toBeNull();
  });

  it('exposes a retry path when workout reads fail', async () => {
    prepare('ATHLETE', true);
    const view = await render(<HomeScreen />);
    await fireEvent.press(view.getByText('Не вдалося завантажити. Повторити'));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
