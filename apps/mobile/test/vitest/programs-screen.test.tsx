import { fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useProgramAssignments } from '@/features/programs/model/program-assignments-query';
import { ProgramsScreen } from '@/screens/programs/ui/programs-screen';

const push = vi.hoisted(() => vi.fn());
vi.mock('expo-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/programs/model/program-assignments-query', () => ({
  useProgramAssignments: vi.fn(),
}));

const refetch = vi.fn();
const fetchNextPage = vi.fn();
const first = { id: 'assignment-1', version: { title: 'Сила', version: 1 }, status: 'ACTIVE' };
const second = { id: 'assignment-2', version: { title: 'Витривалість', version: 2 }, status: 'ACTIVE' };

function prepare(overrides: Record<string, unknown> = {}) {
  vi.mocked(useProgramAssignments).mockReturnValue({
    data: {
      pages: [
        { data: [first], meta: { total: 2, totalPages: 2 } },
        { data: [first, second], meta: { total: 2, totalPages: 2 } },
      ],
    },
    isPending: false,
    isError: false,
    isRefetchError: false,
    isFetchNextPageError: false,
    isFetching: false,
    isFetchingNextPage: false,
    isRefetching: false,
    hasNextPage: true,
    refetch,
    fetchNextPage,
    ...overrides,
  } as unknown as ReturnType<typeof useProgramAssignments>);
}

describe('ProgramsScreen paginated assignments (native)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepare();
  });

  it('deduplicates pages, opens the correct program and loads more manually', async () => {
    const view = await render(<ProgramsScreen />);

    expect(view.getAllByText('Сила')).toHaveLength(1);
    expect(view.getByText('Витривалість')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Відкрити програму Сила' }));
    expect(push).toHaveBeenCalledWith({
      pathname: '/programs/[id]',
      params: { id: 'assignment-1' },
    });
    await fireEvent.press(view.getByTestId('programs-load-more'));
    expect(fetchNextPage).toHaveBeenCalledOnce();
  });

  it('disables pagination and refresh while any request is running', async () => {
    prepare({ isFetching: true, isFetchingNextPage: true });
    const view = await render(<ProgramsScreen />);

    expect(view.getByRole('button', { name: 'Показати більше програм', disabled: true }))
      .toBeTruthy();
    expect(view.getByRole('button', { name: 'Оновити програми', disabled: true })).toBeTruthy();
  });

  it('keeps loaded rows after a failed next page and supports manual retry', async () => {
    prepare({
      isError: true,
      isFetchNextPageError: true,
      error: new Error('Помилка сторінки'),
    });
    const view = await render(<ProgramsScreen />);

    expect(view.getByText('Сила')).toBeTruthy();
    expect(view.getByText('Не вдалося завантажити наступну сторінку програм.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Повторити сторінку' }));
    expect(fetchNextPage).toHaveBeenCalledOnce();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('offers accessible retry on first-page errors', async () => {
    prepare({ data: undefined, isError: true, error: new Error('Немає зв’язку'), hasNextPage: false });
    const view = await render(<ProgramsScreen />);

    expect(view.getByText('Немає зв’язку')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Спробувати ще раз' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('does not invent assignments for empty results', async () => {
    prepare({
      data: { pages: [{ data: [], meta: { total: 0, totalPages: 0 } }] },
      hasNextPage: false,
    });
    const view = await render(<ProgramsScreen />);

    expect(view.getByText('Активних призначень немає.')).toBeTruthy();
    expect(view.queryByTestId('programs-load-more')).toBeNull();
  });
});
