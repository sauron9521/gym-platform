import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { getFlatMessages, type Locale } from '@gym/i18n';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProgramAssignments } from '@/features/programs/model/program-assignments-query';
import { ProgramsScreen } from '@/screens/programs/ui/programs-screen';

const push = vi.hoisted(() => vi.fn());
vi.mock('expo-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/programs/model/program-assignments-query', () => ({
  useProgramAssignments: vi.fn(),
}));

const refetch = vi.fn();
const fetchNextPage = vi.fn();
const first = {
  id: 'assignment-1',
  version: { title: 'Сила', version: 1 },
  status: 'ACTIVE',
};
const second = {
  id: 'assignment-2',
  version: { title: 'Витривалість', version: 2 },
  status: 'ACTIVE',
};

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

function screenFor(locale: Locale) {
  return render(
    <IntlProvider locale={locale} defaultLocale="uk" messages={getFlatMessages(locale)}>
      <ProgramsScreen />
    </IntlProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  prepare();
});
afterEach(async () => {
  await cleanup();
});

describe('ProgramsScreen paginated assignments and native uk/en localization', () => {
  it('deduplicates pages, opens the correct program and loads more manually', async () => {
    const view = await screenFor('uk');
    expect(view.getByText('Мої програми')).toBeTruthy();
    expect(view.getAllByText('Сила')).toHaveLength(1);
    expect(view.getByText('Витривалість')).toBeTruthy();
    expect(view.getAllByText('Версія 1 · Активна')).toHaveLength(1);

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
    const view = await screenFor('uk');

    expect(
      view.getByRole('button', {
        name: 'Показати більше програм',
        disabled: true,
      }),
    ).toBeTruthy();
    expect(view.getByRole('button', { name: 'Оновити програми', disabled: true })).toBeTruthy();
    expect(view.getByText('Завантаження…')).toBeTruthy();
    await fireEvent.press(view.getByTestId('programs-refresh'));
    expect(refetch).not.toHaveBeenCalled();
  });

  it('keeps loaded rows after failed next page and supports manual retry', async () => {
    prepare({
      isError: true,
      isFetchNextPageError: true,
      error: new Error('SECRET_SERVER_RESPONSE'),
    });
    const view = await screenFor('uk');

    expect(view.getByText('Сила')).toBeTruthy();
    expect(view.getByText('Не вдалося завантажити наступну сторінку програм.')).toBeTruthy();
    expect(view.queryByText('SECRET_SERVER_RESPONSE')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Повторити сторінку' }));
    expect(fetchNextPage).toHaveBeenCalledOnce();
    expect(refetch).not.toHaveBeenCalled();
  });

  it.each([
    {
      locale: 'uk' as const,
      message: 'Не вдалося завантажити програми.',
      retry: 'Спробувати ще раз',
    },
    { locale: 'en' as const, message: 'Could not load programs.', retry: 'Try again' },
  ])('offers localized safe first-page feedback in $locale', async ({ locale, message, retry }) => {
    prepare({
      data: undefined,
      isError: true,
      isPending: false,
      error: new Error('SECRET_SERVER_RESPONSE'),
      hasNextPage: false,
    });
    const view = await screenFor(locale);

    expect(view.getByText(message)).toBeTruthy();
    expect(view.queryByText('SECRET_SERVER_RESPONSE')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: retry }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it.each([
    { locale: 'uk' as const, message: 'Активних призначень немає.' },
    { locale: 'en' as const, message: 'No active program assignments.' },
  ])('renders empty state with $locale language', async ({ locale, message }) => {
    prepare({
      data: { pages: [{ data: [], meta: { total: 0, totalPages: 0 } }] },
      hasNextPage: false,
    });
    const view = await screenFor(locale);

    expect(view.getByText(message)).toBeTruthy();
    expect(view.queryByTestId('programs-load-more')).toBeNull();
  });

  it('renders all core controls in English without translating user-created names', async () => {
    const view = await screenFor('en');
    expect(view.getByText('My programs')).toBeTruthy();
    expect(view.getByText('Active programs assigned by your trainer')).toBeTruthy();
    expect(view.getByText('Сила')).toBeTruthy();
    expect(view.getByText('Витривалість')).toBeTruthy();
    expect(view.getByText('Version 1 · Active')).toBeTruthy();
    expect(view.getByText('Version 2 · Active')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Open program Сила' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Show more programs' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Refresh programs' })).toBeTruthy();
    await fireEvent.press(view.getByTestId('programs-refresh'));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('preserves assignment navigation on language switch', async () => {
    const view = await screenFor('en');
    expect(view.getByText('My programs')).toBeTruthy();
    await view.rerender(
      <IntlProvider locale="uk" defaultLocale="uk" messages={getFlatMessages('uk')}>
        <ProgramsScreen />
      </IntlProvider>,
    );
    expect(view.getByText('Мої програми')).toBeTruthy();
    expect(view.getByText('Сила')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Відкрити програму Сила' })).toBeTruthy();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('handles localized loading and manual refresh failure without dropping loaded data', async () => {
    prepare({ isPending: true, data: undefined, hasNextPage: false });
    let view = await screenFor('en');
    expect(view.getByText('Loading programs')).toBeTruthy();
    await cleanup();

    prepare({
      isPending: false,
      isRefetchError: true,
      error: new Error('SECRET'),
      hasNextPage: false,
    });
    view = await screenFor('en');
    expect(view.getByText('Сила')).toBeTruthy();
    expect(
      view.getByText('Could not refresh programs. Showing previously loaded data.'),
    ).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Retry refresh' }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(view.queryByText('SECRET')).toBeNull();
  });

  it('uses translated version statuses without exposing unrecognized API codes', async () => {
    prepare({
      data: {
        pages: [
          {
            data: [
              { ...first, status: 'COMPLETED' },
              { ...second, status: 'TERMINATED' },
              {
                id: 'assignment-3',
                version: { title: 'Програма', version: 3 },
                status: 'UNKNOWN_INTERNAL',
              },
            ],
          },
        ],
      },
      hasNextPage: false,
    });
    const view = await screenFor('en');
    expect(view.getByText('Version 1 · Completed')).toBeTruthy();
    expect(view.getByText('Version 2 · Terminated')).toBeTruthy();
    expect(view.getByText('Version 3 · Status unavailable')).toBeTruthy();
    expect(view.queryByText('UNKNOWN_INTERNAL')).toBeNull();
  });
});
