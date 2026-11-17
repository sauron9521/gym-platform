import { fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTrainerAthletes } from '@/features/trainer-athletes/model/trainer-athletes-query';
import { TrainerAthletesScreen } from '@/screens/trainer-athletes/ui/trainer-athletes-screen';

const fetchNextPage = vi.fn();
const refetch = vi.fn();

vi.mock('@/features/trainer-athletes/model/trainer-athletes-query', () => ({
  useTrainerAthletes: vi.fn(),
}));
vi.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) =>
      ({
        'mobile.trainerAthletes.title': 'Мої підопічні',
        'mobile.trainerAthletes.subtitle': 'Активні зв’язки зі спортсменами',
        'mobile.trainerAthletes.empty': 'Активних підопічних немає.',
        'mobile.trainerAthletes.athlete': 'Спортсмен',
        'mobile.trainerAthletes.loading': 'Завантаження…',
        'mobile.trainerAthletes.loadingMore': 'Завантаження…',
        'mobile.trainerAthletes.loadMore': 'Показати ще',
        'mobile.trainerAthletes.retryLoadMore': 'Помилка завантаження. Повторити',
      })[id] ?? id,
  }),
}));

function prepare({ empty = false, pageError = false, loading = false } = {}) {
  const data = empty
    ? { pages: [{ data: [] }] }
    : {
        pages: [
          { data: [{ id: 'relation-one', athlete: { id: 'athlete-12345678' } }] },
          { data: [{ id: 'relation-one', athlete: { id: 'athlete-12345678' } }] },
        ],
      };

  vi.mocked(useTrainerAthletes).mockReturnValue({
    data: loading ? undefined : data,
    isPending: loading,
    isError: false,
    isFetching: false,
    isRefetching: false,
    isFetchingNextPage: false,
    isFetchNextPageError: pageError,
    hasNextPage: pageError,
    fetchNextPage,
    refetch,
  } as unknown as ReturnType<typeof useTrainerAthletes>);
}

describe('TrainerAthletesScreen native', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepare();
  });

  it('deduplicates athletes and allows a manual refresh', async () => {
    const view = await render(<TrainerAthletesScreen />);
    expect(view.getAllByText('Спортсмен · athlete-')).toHaveLength(1);
    await fireEvent(view.getByTestId('trainer-athletes-list'), 'refresh');
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state without exposing email addresses', async () => {
    prepare({ empty: true });
    const view = await render(<TrainerAthletesScreen />);
    expect(view.getByText('Активних підопічних немає.')).toBeTruthy();
    expect(view.queryByText(/@/)).toBeNull();
  });

  it('supports explicit retry on pagination failure', async () => {
    prepare({ pageError: true });
    const view = await render(<TrainerAthletesScreen />);
    expect(view.getByText('Помилка завантаження. Повторити')).toBeTruthy();
    await fireEvent.press(view.getByTestId('trainer-athletes-load-more'));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('renders a pending placeholder', async () => {
    prepare({ loading: true });
    const view = await render(<TrainerAthletesScreen />);
    expect(view.getByText('Завантаження…')).toBeTruthy();
  });
});
