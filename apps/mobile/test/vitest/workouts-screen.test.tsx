import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react-native';

import { useAuth } from '@/features/auth/model/auth-context';
import { useWorkoutsQuery } from '@/features/workouts/model/workouts-query';
import { WorkoutsScreen } from '@/screens/workouts/ui/workouts-screen';

const push = vi.fn();
const fetchNextPage = vi.fn();
const refetch = vi.fn();

vi.mock('expo-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/features/workouts/model/workouts-query', () => ({ useWorkoutsQuery: vi.fn() }));

const workout = {
  id: 'workout-1',
  title: 'Силове тренування',
  status: 'IN_PROGRESS' as const,
  scheduledAt: null,
};

function mockList(
  options: {
    role?: 'ATHLETE' | 'TRAINER';
    hasNextPage?: boolean;
    isFetchNextPageError?: boolean;
    pages?: { data: typeof workout[] }[];
  } = {},
) {
  vi.mocked(useAuth).mockReturnValue({
    account: { id: 'athlete-1', role: options.role ?? 'ATHLETE' },
  } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(useWorkoutsQuery).mockReturnValue({
    data: { pages: options.pages ?? [{ data: [workout] }] },
    isPending: false,
    isError: false,
    isFetching: false,
    isRefetching: false,
    hasNextPage: options.hasNextPage ?? false,
    isFetchingNextPage: false,
    isFetchNextPageError: options.isFetchNextPageError ?? false,
    fetchNextPage,
    refetch,
  } as unknown as ReturnType<typeof useWorkoutsQuery>);
}

describe('WorkoutsScreen (React Native)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchNextPage.mockResolvedValue(undefined);
    refetch.mockResolvedValue(undefined);
    mockList();
  });

  it('renders cached workout pages without duplicates and preserves athlete creation', async () => {
    mockList({ pages: [{ data: [workout] }, { data: [workout] }] });
    const view = await render(<WorkoutsScreen />);

    expect(view.getAllByText('Силове тренування')).toHaveLength(1);
    expect(view.getByTestId('workouts-create')).toBeTruthy();
    await fireEvent.press(view.getByTestId('workouts-create'));
    expect(push).toHaveBeenCalledWith('/workouts/new');
  });

  it('filters status and offers a manual refresh', async () => {
    const view = await render(<WorkoutsScreen />);
    await fireEvent.press(view.getByTestId('workouts-filter-COMPLETED'));
    expect(useWorkoutsQuery).toHaveBeenCalledWith('COMPLETED');

    await fireEvent.press(view.getByTestId('workouts-refresh'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('allows recovery after a failed page but disables automatic retry loops', async () => {
    mockList({ hasNextPage: true, isFetchNextPageError: true });
    const view = await render(<WorkoutsScreen />);
    expect(view.getByText('Помилка завантаження. Спробувати ще')).toBeTruthy();
    expect(fetchNextPage).not.toHaveBeenCalled();

    await fireEvent.press(view.getByTestId('workouts-load-more'));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('hides athlete-only workout creation for trainers', async () => {
    mockList({ role: 'TRAINER' });
    const view = await render(<WorkoutsScreen />);
    expect(view.queryByTestId('workouts-create')).toBeNull();
  });
});
