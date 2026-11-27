import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { onlineManager, focusManager } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from '@gym/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminInboxProvider } from '@/features/notifications/model/inbox-session';
import { InboxBell } from '@/features/notifications/ui/admin-inbox-bell';
import { AdminInboxScreen } from '@/features/notifications/ui/admin-inbox-screen';
import {
  InboxError,
  parseItem,
  parsePage,
  markRead,
  readInbox,
  unreadCount,
  type InboxItem,
} from '@/features/notifications/api/inbox';

vi.mock('@/features/notifications/api/inbox', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/notifications/api/inbox')>();
  return { ...actual, markRead: vi.fn(), readInbox: vi.fn(), unreadCount: vi.fn() };
});
const owner = '00000000-0000-4000-8000-000000000099';
const other = '00000000-0000-4000-8000-000000000098';
const notice: InboxItem = {
  id: '00000000-0000-4000-8000-000000000096',
  type: 'admin.trainer.review.required',
  category: 'ACCOUNT',
  templateKey: 'admin.trainer.review.required',
  createdAt: '2026-11-27T09:00:00.000Z',
  readAt: null,
};
let item: InboxItem;
let visibility: 'visible' | 'hidden';
let online: boolean;
function tree(id = owner, locale: 'en' | 'uk' = 'en') {
  return (
    <NextIntlClientProvider locale={locale} messages={getMessages(locale)} timeZone="UTC">
      <AdminInboxProvider owner={id}>
        <InboxBell />
        <AdminInboxScreen />
      </AdminInboxProvider>
    </NextIntlClientProvider>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  visibility = 'visible';
  online = true;
  onlineManager.setOnline(true);
  focusManager.setFocused(true);
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  item = { ...notice };
  vi.mocked(unreadCount).mockImplementation(async (id) =>
    id === owner && item.readAt === null ? 1 : 0,
  );
  vi.mocked(readInbox).mockImplementation(async (id, _cursor, unread) => ({
    data: id === owner && (!unread || item.readAt === null) ? [item] : [],
    nextCursor: null,
  }));
  vi.mocked(markRead).mockImplementation(async () => {
    item = { ...item, readAt: '2026-11-27T10:00:00.000Z' };
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
});
describe('Admin Inbox', () => {
  it('strictly rejects unexpected/private data and unknown events', () => {
    expect(parseItem(notice)).toEqual(notice);
    expect(() => parseItem({ ...notice, applicantId: other })).toThrow(InboxError);
    expect(() => parseItem({ ...notice, type: 'billing.approval' })).toThrow(InboxError);
    expect(() => parsePage({ data: [notice, notice], nextCursor: null })).toThrow(InboxError);
  });
  it('shows unread count, read-only review notice, and canonical read mutation without pending action change', async () => {
    render(tree());
    expect(await screen.findByRole('link', { name: 'Unread notifications: 1' })).toBeTruthy();
    expect(
      await screen.findByRole('heading', { name: 'Trainer application requires review' }),
    ).toBeTruthy();
    expect(screen.getByText(/not a pending-action count/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mark read' }));
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Unread notifications: 0' })).toBeTruthy(),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Trainer application requires review' }),
      ).toBeTruthy(),
    );
    expect(markRead).toHaveBeenCalledExactlyOnceWith(owner, notice.id);
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Unread' }));
    expect(await screen.findByText('No notifications to display.')).toBeTruthy();
  });
  it.each([401, 403, 409])(
    'hides all private content and stops reads when access is rejected (%i)',
    async (status) => {
      render(tree());
      await screen.findByRole('heading', { name: 'Trainer application requires review' });
      vi.mocked(unreadCount).mockRejectedValueOnce(new InboxError(status));
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
      expect(await screen.findByText(/Notification access changed/)).toBeTruthy();
      expect(
        screen.queryByRole('heading', { name: 'Trainer application requires review' }),
      ).toBeNull();
      expect(screen.queryByRole('link', { name: /Unread notifications/ })).toBeNull();
      const calls = vi.mocked(unreadCount).mock.calls.length;
      fireEvent(window, new Event('focus'));
      expect(unreadCount).toHaveBeenCalledTimes(calls);
    },
  );
  it('hides on background/offline and fences account switch', async () => {
    const view = render(tree());
    await screen.findByRole('heading', { name: 'Trainer application requires review' });
    await act(async () => {
      visibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(
      screen.queryByRole('heading', { name: 'Trainer application requires review' }),
    ).toBeNull();
    await act(async () => {
      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await screen.findByRole('heading', { name: 'Trainer application requires review' });
    view.rerender(tree(other, 'uk'));
    await screen.findByText('Немає сповіщень для перегляду.');
    expect(screen.queryByRole('heading', { name: 'Заявка тренера потребує розгляду' })).toBeNull();
    expect(await screen.findByRole('link', { name: 'Непрочитані сповіщення: 0' })).toBeTruthy();
    await act(async () => {
      online = false;
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.queryByRole('link', { name: /Непрочитані сповіщення/ })).toBeNull();
  });
  it('never replays a failed read mutation; reconciles via GET', async () => {
    render(tree());
    await screen.findByRole('heading', { name: 'Trainer application requires review' });
    vi.mocked(markRead).mockRejectedValueOnce(new InboxError(503));
    fireEvent.click(screen.getByRole('button', { name: 'Mark read' }));
    expect(await screen.findByText(/read status could not be confirmed/)).toBeTruthy();
    expect(markRead).toHaveBeenCalledOnce();
    expect(await screen.findByRole('button', { name: 'Mark read' })).toBeTruthy();
  });
});
