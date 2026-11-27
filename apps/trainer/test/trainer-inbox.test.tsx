// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from '@gym/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrainerInboxProvider } from '../src/features/notifications/model/inbox-session';
import { InboxBell } from '../src/features/notifications/ui/inbox-bell';
import { TrainerInboxScreen } from '../src/features/notifications/ui/inbox-screen';
import { InboxError, type InboxItem } from '../src/features/notifications/api/inbox';

const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  count: vi.fn(),
  list: vi.fn(),
  read: vi.fn(),
  resolve: vi.fn(),
  push: vi.fn(),
}));
vi.mock('../src/features/notifications/api/inbox', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/features/notifications/api/inbox')>();
  return {
    ...actual,
    readOwner: mocks.owner,
    unreadCount: mocks.count,
    readInbox: mocks.list,
    markRead: mocks.read,
    resolveClient: mocks.resolve,
  };
});
vi.mock('next/navigation', () => ({
  usePathname: () => '/workspace/notifications',
  useRouter: () => ({ push: mocks.push }),
}));
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333';
const relation = '44444444-4444-4444-8444-444444444444';
const accountId = '55555555-5555-4555-8555-555555555555';
const stamp = '2026-11-27T08:00:00.000Z';
const accepted: InboxItem = {
  id,
  type: 'trainer.invitation.accepted',
  templateKey: 'trainer.invitation.accepted',
  category: 'TRAINER',
  readAt: null,
  createdAt: stamp,
  target: { kind: 'TRAINER_RELATIONSHIP', id: relation },
};
const account: InboxItem = {
  id: accountId,
  type: 'trainer.application.reviewed',
  templateKey: 'trainer.application.reviewed',
  category: 'ACCOUNT',
  readAt: null,
  createdAt: stamp,
};
let rows: InboxItem[];
let currentOwner: string;
let visibility: DocumentVisibilityState;
let denied = false;
beforeEach(() => {
  rows = [{ ...accepted }, { ...account }];
  currentOwner = owner;
  denied = false;
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  mocks.owner.mockImplementation(async () => currentOwner);
  mocks.count.mockImplementation(async (expected: string) => {
    if (denied) throw new InboxError(403);
    if (expected !== currentOwner) throw new InboxError(409);
    return rows.filter((row) => !row.readAt).length;
  });
  mocks.list.mockImplementation(
    async (
      expected: string,
      filters: { category?: string; unread?: string },
      cursor: string | null,
    ) => {
      if (denied) throw new InboxError(403);
      if (expected !== currentOwner) throw new InboxError(409);
      const filtered = rows.filter(
        (row) =>
          (!filters.category || filters.category === row.category) &&
          (!filters.unread || !row.readAt),
      );
      return {
        data: cursor ? filtered.slice(1) : filtered.slice(0, 1),
        nextCursor: !cursor && filtered.length > 1 ? 'next' : null,
      };
    },
  );
  mocks.read.mockImplementation(async (_owner: string, item?: string) => {
    rows = rows.map((row) => (!item || row.id === item ? { ...row, readAt: stamp } : row));
  });
  mocks.resolve.mockResolvedValue('/workspace/clients/' + relation);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function mount(locale: 'uk' | 'en' = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={getMessages(locale)} timeZone="UTC">
      <TrainerInboxProvider>
        <InboxBell />
        <TrainerInboxScreen />
      </TrainerInboxProvider>
    </NextIntlClientProvider>,
  );
}
async function loaded() {
  await screen.findByRole('heading', { name: 'Coaching invitation accepted' });
  await screen.findByRole('link', { name: 'Notifications (2 unread)' });
}
describe('Trainer Inbox with real QueryClient', () => {
  it('loads cursor pages, marks read on the server and filters shared account records', async () => {
    mount();
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByRole('heading', { name: 'Your trainer application has been reviewed' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark as read: Coaching invitation accepted' }),
    );
    await screen.findByRole('link', { name: 'Notifications (1 unread)' });
    expect(mocks.read).toHaveBeenCalledExactlyOnceWith(owner, id);
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'ACCOUNT' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Unread only' }));
    await screen.findByRole('heading', { name: 'Your trainer application has been reviewed' });
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await screen.findByText('No notifications to show.');
    await screen.findByRole('link', { name: 'Notifications (0 unread)' });
    expect(mocks.read).toHaveBeenLastCalledWith(owner, undefined);
    expect(mocks.owner).toHaveBeenCalledOnce();
  });
  it('uses localized safe navigation and rejects revoked targets', async () => {
    mount('uk');
    await screen.findByRole('heading', { name: 'Запрошення прийнято' });
    fireEvent.click(screen.getByRole('button', { name: 'Відкрити клієнта' }));
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/workspace/clients/' + relation),
    );
    mocks.push.mockClear();
    mocks.resolve.mockRejectedValueOnce(new InboxError(404));
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Відкрити клієнта' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Відкрити клієнта' }));
    await screen.findByText('Це сповіщення або клієнт більше недоступні.');
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it('hides old rows and verifies the new owner on mismatch', async () => {
    mount();
    await loaded();
    currentOwner = other;
    rows = [{ ...account }];
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await screen.findByRole('heading', { name: 'Your trainer application has been reviewed' });
    expect(screen.queryByRole('heading', { name: 'Coaching invitation accepted' })).toBeNull();
    expect(mocks.owner).toHaveBeenCalledTimes(2);
    expect(mocks.list).toHaveBeenLastCalledWith(other, {}, null, expect.any(AbortSignal));
  });
  it('stops private requests while hidden and after confirmed logout', async () => {
    mount();
    await loaded();
    await act(async () => {
      visibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const before = [mocks.count.mock.calls.length, mocks.list.mock.calls.length];
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect([mocks.count.mock.calls.length, mocks.list.mock.calls.length]).toEqual(before);
    await act(async () => {
      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await loaded();
    await act(async () => {
      window.dispatchEvent(new Event('trainer-session-ended'));
    });
    await screen.findByText('Could not verify your account. Please try again.');
    const ended = [mocks.count.mock.calls.length, mocks.list.mock.calls.length];
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect([mocks.count.mock.calls.length, mocks.list.mock.calls.length]).toEqual(ended);
    expect(screen.queryByRole('heading', { name: 'Coaching invitation accepted' })).toBeNull();
  });
  it('fails closed after current trainer capability is revoked', async () => {
    mount();
    await loaded();
    denied = true;
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await screen.findByText('Could not verify your account. Please try again.');
    expect(screen.queryByRole('heading', { name: 'Coaching invitation accepted' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Notifications/ })).toBeNull();
  });
  it('polls only the count in the foreground and never repeats the profile read', async () => {
    vi.useFakeTimers();
    try {
      const mounted = mount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(screen.getByRole('link', { name: 'Notifications (2 unread)' })).toBeTruthy();
      const before = [
        mocks.owner.mock.calls.length,
        mocks.count.mock.calls.length,
        mocks.list.mock.calls.length,
      ];
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect([
        mocks.owner.mock.calls.length,
        mocks.count.mock.calls.length,
        mocks.list.mock.calls.length,
      ]).toEqual([before[0], before[1]! + 1, before[2]]);
      await act(async () => {
        visibility = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(100);
      });
      const hidden = [mocks.count.mock.calls.length, mocks.list.mock.calls.length];
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000);
      });
      expect([mocks.count.mock.calls.length, mocks.list.mock.calls.length]).toEqual(hidden);
      mounted.unmount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000);
      });
      expect([mocks.count.mock.calls.length, mocks.list.mock.calls.length]).toEqual(hidden);
    } finally {
      vi.useRealTimers();
    }
  });
});
