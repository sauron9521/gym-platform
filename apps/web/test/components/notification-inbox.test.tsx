import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from '@gym/i18n';
import { InboxSessionBoundary, inboxKeys } from '@/features/notifications/model/inbox-session';
import { InboxPageScreen } from '@/features/notifications/ui/inbox-page';
import { InboxBell } from '@/features/notifications/ui/inbox-bell';
import { inboxDestination } from '@/features/notifications/model/inbox-presentation';
import { type InboxItem } from '@/features/notifications/api/inbox';

const { get, patch, post, replace } = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  replace: vi.fn(),
}));
vi.mock('@/shared/api/client', () => ({ webApi: { GET: get, PATCH: patch, POST: post } }));
const router = { replace };
vi.mock('next/navigation', () => ({
  usePathname: () => '/notifications',
  useRouter: () => router,
}));

const date = '2026-11-27T08:00:00.000Z';
const program: InboxItem = {
  id: 'program-id',
  type: 'program.assigned',
  category: 'PROGRAM',
  templateKey: 'program.assigned',
  createdAt: date,
  readAt: null,
  target: { kind: 'PROGRAM_ASSIGNMENT', id: 'assignment-id' },
};
const security: InboxItem = {
  id: 'security-id',
  type: 'account.security.changed',
  category: 'ACCOUNT',
  templateKey: 'account.security.changed',
  createdAt: date,
  readAt: null,
};
const reviewed: InboxItem = {
  id: 'review-id',
  type: 'trainer.application.reviewed',
  category: 'ACCOUNT',
  templateKey: 'trainer.application.reviewed',
  createdAt: date,
  readAt: null,
};
let owner: string;
let rows: InboxItem[];
let client: QueryClient;
let visibility: DocumentVisibilityState;
let sessionStatus: number;
let listStatus: number;
const ok = (data: unknown) => ({ response: { status: 200, ok: true }, data });
const fail = (status: number) => ({ response: { status, ok: false } });

beforeEach(() => {
  owner = 'athlete-a';
  rows = [program, security];
  sessionStatus = 200;
  listStatus = 200;
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  replace.mockReset();
  get.mockReset().mockImplementation(
    async (
      path: string,
      options?: {
        headers?: Record<string, string>;
        params?: { query?: { category?: string; unread?: string; cursor?: string } };
      },
    ) => {
      if (path === '/users/me')
        return sessionStatus === 200 ? ok({ id: owner, role: 'ATHLETE' }) : fail(sessionStatus);
      if (path.startsWith('/notifications')) {
        if (sessionStatus !== 200) return fail(sessionStatus);
        if (options?.headers?.['x-inbox-owner'] !== owner) return fail(409);
      }
      if (path === '/notifications/unread-count')
        return ok({ count: rows.filter((row) => !row.readAt).length });
      if (path === '/notifications') {
        if (listStatus !== 200) return fail(listStatus);
        const q = options?.params?.query;
        const filtered = rows.filter(
          (row) => (!q?.category || row.category === q.category) && (!q?.unread || !row.readAt),
        );
        return ok({
          data: q?.cursor ? filtered.slice(1) : filtered.slice(0, 1),
          nextCursor: !q?.cursor && filtered.length > 1 ? 'cursor-two' : null,
        });
      }
      throw new Error('Unexpected request');
    },
  );
  patch
    .mockReset()
    .mockImplementation(async (_path: string, options: { params: { path: { id: string } } }) => {
      rows = rows.map((row) =>
        row.id === options.params.path.id ? { ...row, readAt: date } : row,
      );
      return ok({});
    });
  post.mockReset().mockImplementation(async () => {
    rows = rows.map((row) => ({ ...row, readAt: date }));
    return { response: { status: 204, ok: true } };
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

function mount(locale: 'en' | 'uk' = 'en') {
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale={locale} messages={getMessages(locale)} timeZone="UTC">
        <InboxSessionBoundary>
          <InboxBell />
          <InboxPageScreen />
        </InboxSessionBoundary>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}
const countCalls = () =>
  get.mock.calls.filter(([path]) => path === '/notifications/unread-count').length;
const profileCalls = () => get.mock.calls.filter(([path]) => path === '/users/me').length;
const listCalls = () => get.mock.calls.filter(([path]) => path === '/notifications').length;
async function loaded() {
  await screen.findByRole('heading', { name: 'A training program was assigned' });
  await screen.findByRole('link', { name: 'Notifications (2 unread)' });
}

describe('Athlete notifications', () => {
  it('renders badge, pagination, localized filters and server-authoritative read state', async () => {
    mount();
    await loaded();
    expect(
      screen
        .getByRole('link', { name: 'Open section: A training program was assigned' })
        .getAttribute('href'),
    ).toBe('/athlete/programs');
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByRole('heading', { name: 'Your account security settings changed' });
    expect(
      get.mock.calls.some(
        ([path, opts]) => path === '/notifications' && opts.params.query.cursor === 'cursor-two',
      ),
    ).toBe(true);
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark as read: A training program was assigned' }),
    );
    await screen.findByRole('link', { name: 'Notifications (1 unread)' });
    expect(patch).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'ACCOUNT' } });
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'A training program was assigned' })).toBeNull(),
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Unread only' }));
    await screen.findByRole('heading', { name: 'Your account security settings changed' });
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await screen.findByText('No notifications to show.');
    await screen.findByRole('link', { name: 'Notifications (0 unread)' });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('uses the Ukrainian catalog and generic review text without inventing an approval', async () => {
    rows = [reviewed];
    mount('uk');
    await screen.findByRole('heading', { name: 'Вашу заявку тренера розглянуто' });
    expect(screen.queryByRole('link', { name: /Відкрити розділ/ })).toBeNull();
    expect(
      inboxDestination({
        ...program,
        target: { kind: 'URL', id: 'https://evil.test' },
      } as unknown as InboxItem),
    ).toBeNull();
  });

  it('makes no Inbox requests while hidden or unauthenticated, then refreshes after visibility', async () => {
    visibility = 'hidden';
    mount();
    expect(get).not.toHaveBeenCalled();
    await act(async () => {
      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await loaded();
    await act(async () => {
      visibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const before = [countCalls(), listCalls()];
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect([countCalls(), listCalls()]).toEqual(before);
    sessionStatus = 401;
    await act(async () => {
      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByRole('heading', { name: 'A training program was assigned' })).toBeNull();
    expect(client.getQueryData(inboxKeys.count('athlete-a'))).toBeUndefined();
  });

  it('rechecks owner on focus, removes old account data and does not show stale rows', async () => {
    mount();
    await loaded();
    owner = 'athlete-b';
    rows = [reviewed];
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await screen.findByRole('heading', { name: 'Your trainer application has been reviewed' });
    expect(screen.queryByRole('heading', { name: 'A training program was assigned' })).toBeNull();
    expect(client.getQueriesData({ queryKey: inboxKeys.owner('athlete-a') })).toEqual([]);
    expect(replace).not.toHaveBeenCalled();
  });

  it('fails closed on 403 without redirect or displaying previous private data', async () => {
    mount();
    await loaded();
    listStatus = 403;
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await screen.findByText('Could not verify your account. Please try again.');
    expect(screen.queryByRole('heading', { name: 'A training program was assigned' })).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
  it('polls only unread count every minute, pauses while hidden and stops after unmount', async () => {
    vi.useFakeTimers();
    try {
      const mounted = mount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(screen.getByRole('link', { name: 'Notifications (2 unread)' })).toBeTruthy();
      const before = [countCalls(), listCalls()];
      const beforeProfile = profileCalls();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(countCalls()).toBe(before[0]! + 1);
      expect(listCalls()).toBe(before[1]);
      expect(profileCalls()).toBe(beforeProfile);
      await act(async () => {
        visibility = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(100);
      });
      const hidden = [countCalls(), listCalls()];
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000);
      });
      expect([countCalls(), listCalls()]).toEqual(hidden);
      mounted.unmount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000);
      });
      expect([countCalls(), listCalls()]).toEqual(hidden);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not mark a row read optimistically when the server rejects the write', async () => {
    mount();
    await loaded();
    patch.mockResolvedValueOnce(fail(500));
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark as read: A training program was assigned' }),
    );
    await screen.findByText('Could not update read status. Please try again.');
    expect(
      screen.getByRole('button', { name: 'Mark as read: A training program was assigned' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Notifications (2 unread)' })).toBeTruthy();
  });
});
