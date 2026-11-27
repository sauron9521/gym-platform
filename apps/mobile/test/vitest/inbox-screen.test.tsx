import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { getFlatMessages, type Locale } from '@gym/i18n';
import { IntlProvider } from 'react-intl';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { accountQueryKeys, createMobileQueryClient } from '@/shared/api/query-client';
import { InboxScreen } from '@/features/notifications/ui/inbox-screen';
import { InboxBell } from '@/features/notifications/ui/inbox-bell';
import { inboxKeys, useInboxCount } from '@/features/notifications/model/inbox-query';
import { useAuth } from '@/features/auth/model/auth-context';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  push: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
const router = { push: mocks.push };
vi.mock('expo-router', () => ({
  useRouter: () => router,
  useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]),
}));

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const programId = '33333333-3333-4333-8333-333333333333';
const accountId = '44444444-4444-4444-8444-444444444444';
const assignmentId = '55555555-5555-4555-8555-555555555555';
const stamp = '2026-11-27T08:00:00.000Z';
const program = {
  id: programId,
  type: 'program.assigned',
  category: 'PROGRAM',
  templateKey: 'program.assigned',
  createdAt: stamp,
  readAt: null as string | null,
  target: { kind: 'PROGRAM_ASSIGNMENT', id: assignmentId },
};
const account = {
  id: accountId,
  type: 'trainer.application.reviewed',
  category: 'ACCOUNT',
  templateKey: 'trainer.application.reviewed',
  createdAt: stamp,
  readAt: null as string | null,
};
let rows: (typeof program | typeof account)[];
let client: ReturnType<typeof createMobileQueryClient>;
let activeOwner: string;
const grants = { athlete: true, trainer: false, admin: false };
const ok = (data: unknown) => ({ response: { status: 200, ok: true }, data });
const fail = (status: number) => ({ response: { status, ok: false } });
const getScopedApi = (current: () => boolean) =>
  current() ? { GET: mocks.get, PATCH: mocks.patch, POST: mocks.post } : null;
function auth(id: string | null) {
  activeOwner = id ?? '';
  vi.mocked(useAuth).mockReturnValue({
    account: id ? { id } : null,
    capabilities: id ? grants : null,
    getScopedApi,
    signOut: mocks.signOut,
  } as unknown as ReturnType<typeof useAuth>);
}
function App({ locale = 'en', signedIn = true }: { locale?: Locale; signedIn?: boolean }) {
  const { count } = useInboxCount();
  return (
    <IntlProvider locale={locale} messages={getFlatMessages(locale)} timeZone="UTC">
      <InboxBell count={count} />
      {signedIn ? <InboxScreen key={activeOwner} /> : null}
    </IntlProvider>
  );
}
const tree = (locale: Locale = 'en', signedIn = true) => (
  <QueryClientProvider client={client}>
    <App locale={locale} signedIn={signedIn} />
  </QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
  client = createMobileQueryClient();
  client.setQueryData(accountQueryKeys.me(owner), { id: owner });
  auth(owner);
  rows = [{ ...program }, { ...account }];
  mocks.get.mockImplementation(
    async (
      path: string,
      options: {
        headers?: Record<string, string>;
        params?: { query?: { category?: string; unread?: string; cursor?: string } };
      },
    ) => {
      if (path.startsWith('/notifications') && options.headers?.['x-inbox-owner'] !== activeOwner)
        return fail(409);
      if (path === '/notifications/unread-count')
        return ok({ count: rows.filter((row) => !row.readAt).length });
      if (path === '/notifications/{id}') return ok(program);
      if (path === '/training-programs/assignments/{assignmentId}')
        return ok({ id: assignmentId, athleteId: activeOwner });
      if (path === '/notifications') {
        const q = options.params?.query;
        const filtered = rows.filter(
          (row) => (!q?.category || row.category === q.category) && (!q?.unread || !row.readAt),
        );
        return ok({
          data: q?.cursor ? filtered.slice(1) : filtered.slice(0, 1),
          nextCursor: !q?.cursor && filtered.length > 1 ? 'next' : null,
        });
      }
      throw new Error('Unexpected request');
    },
  );
  mocks.patch.mockImplementation(
    async (_path: string, options: { params: { path: { id: string } } }) => {
      rows = rows.map((row) =>
        row.id === options.params.path.id ? { ...row, readAt: stamp } : row,
      );
      return ok({});
    },
  );
  mocks.post.mockImplementation(async () => {
    rows = rows.map((row) => ({ ...row, readAt: stamp }));
    return { response: { status: 204, ok: true } };
  });
});
afterEach(async () => {
  await cleanup();
  client.clear();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

describe('Mobile Inbox UI with real TanStack Query', () => {
  it('renders badge and pagination, reads canonical state and filters in both languages', async () => {
    const view = await render(tree());
    await waitFor(() => expect(view.getByText('A training program was assigned')).toBeTruthy());
    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Notifications (2 unread)' })).toBeTruthy(),
    );
    await fireEvent.press(view.getByTestId('mobile-inbox-bell'));
    expect(mocks.push).toHaveBeenCalledWith('/notifications');
    await fireEvent.press(view.getByTestId('mobile-inbox-load-more'));
    await waitFor(() =>
      expect(view.getByText('Your trainer application has been reviewed')).toBeTruthy(),
    );
    await fireEvent.press(view.getByTestId('mobile-inbox-read-' + programId));
    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Notifications (1 unread)' })).toBeTruthy(),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Account' }));
    await fireEvent.press(view.getByRole('checkbox', { name: 'Unread only' }));
    await waitFor(() =>
      expect(view.getByText('Your trainer application has been reviewed')).toBeTruthy(),
    );
    expect(view.queryByText('A training program was assigned')).toBeNull();
    await fireEvent.press(view.getByTestId('mobile-inbox-read-all'));
    await waitFor(() => expect(view.getByText('No notifications to show.')).toBeTruthy());
    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Notifications (0 unread)' })).toBeTruthy(),
    );
    expect(mocks.patch).toHaveBeenCalledOnce();
    expect(mocks.post).toHaveBeenCalledOnce();
    await view.rerender(tree('uk'));
    expect(view.getByText('Немає сповіщень.')).toBeTruthy();
  });

  it('opens a freshly authorized program and refuses denied resource navigation', async () => {
    const view = await render(tree('uk'));
    await waitFor(() => expect(view.getByText('Призначено тренувальну програму')).toBeTruthy());
    await fireEvent.press(view.getByTestId('mobile-inbox-open-' + programId));
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith({
        pathname: '/programs/[id]',
        params: { id: assignmentId },
      }),
    );
    mocks.push.mockClear();
    const base = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation(async (path: string, options: unknown) =>
      path === '/training-programs/assignments/{assignmentId}' ? fail(403) : base(path, options),
    );
    await waitFor(() =>
      expect(
        view.getByTestId('mobile-inbox-open-' + programId).props.accessibilityState?.disabled,
      ).toBe(false),
    );
    await fireEvent.press(view.getByTestId('mobile-inbox-open-' + programId));
    await waitFor(() =>
      expect(view.getByText('Це сповіщення або програма більше недоступні.')).toBeTruthy(),
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('removes old account cache and renders only the next account after auth clear', async () => {
    const view = await render(tree());
    await waitFor(() => expect(view.getByText('A training program was assigned')).toBeTruthy());
    await act(async () => {
      client.clear();
      client.setQueryData(accountQueryKeys.me(other), { id: other });
      auth(other);
      rows = [{ ...account }];
    });
    await view.rerender(tree());
    await waitFor(() =>
      expect(view.getByText('Your trainer application has been reviewed')).toBeTruthy(),
    );
    expect(view.queryByText('A training program was assigned')).toBeNull();
    expect(client.getQueriesData({ queryKey: inboxKeys.owner(owner) })).toEqual([]);
    expect(client.getQueryData(inboxKeys.count(other))).toBe(1);
  });

  it('hides denied data instead of preserving stale rows and keeps the user signed in', async () => {
    const view = await render(tree());
    await waitFor(() => expect(view.getByText('A training program was assigned')).toBeTruthy());
    const base = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation(async (path: string, options: unknown) =>
      path === '/notifications' ? fail(403) : base(path, options),
    );
    await act(async () => {
      await client.invalidateQueries({ queryKey: inboxKeys.owner(owner) });
    });
    await waitFor(() => expect(view.getByText('Could not load notifications.')).toBeTruthy());
    expect(view.queryByText('A training program was assigned')).toBeNull();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
