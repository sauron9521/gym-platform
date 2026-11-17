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

function prepare(role: 'ATHLETE' | 'TRAINER', pageError = false) {
  vi.mocked(useAuth).mockReturnValue({
    account: { id: 'user-1', role },
  } as unknown as ReturnType<typeof useAuth>);

  vi.mocked(useWorkoutsQuery).mockReturnValue({
    data: {
      pages: [
        { data: [{ id: 'one', title: 'Силове', status: 'IN_PROGRESS', scheduledAt: null }] },
        { data: [{ id: 'one', title: 'Силове', status: 'IN_PROGRESS', scheduledAt: null }] },
      ],
    },
    isPending: false,
    isError: false,
    isFetching: false,
    isRefetching: false,
    hasNextPage: pageError,
    isFetchingNextPage: false,
    isFetchNextPageError: pageError,
    fetchNextPage,
    refetch,
  } as unknown as ReturnType<typeof useWorkoutsQuery>);
}

describe('WorkoutsScreen native pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepare('ATHLETE');
  });

  it('retains create, status filters and refresh without duplicate rows', async () => {
    const view = await render(<WorkoutsScreen />);
    expect(view.getAllByText('Силове')).toHaveLength(1);

    await fireEvent.press(view.getByTestId('workouts-create'));
    expect(push).toHaveBeenCalledWith('/workouts/new');

    await fireEvent.press(view.getByTestId('workouts-filter-COMPLETED'));
    expect(useWorkoutsQuery).toHaveBeenCalledWith('COMPLETED');

    await fireEvent.press(view.getByTestId('workouts-refresh'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('guards creation and supports manual retry after a failed page', async () => {
    prepare('TRAINER', true);
    const view = await render(<WorkoutsScreen />);

    expect(view.queryByTestId('workouts-create')).toBeNull();
    expect(view.getByText('Помилка завантаження. Спробувати ще')).toBeTruthy();
    expect(fetchNextPage).not.toHaveBeenCalled();

    await fireEvent.press(view.getByTestId('workouts-load-more'));
    expect(fetchNextPage).toHaveBeenCalledOnce();
  });
});
