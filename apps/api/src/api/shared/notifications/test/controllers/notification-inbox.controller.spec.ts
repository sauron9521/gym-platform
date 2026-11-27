import type { UsersService } from '#src/modules/users/public-api';
import type { NotificationInboxService } from '#src/modules/notifications/public-api';
import { NotificationInboxController } from '../../controllers/notification-inbox.controller.js';

describe('NotificationInboxController', () => {
  const service = {
    list: vi.fn(),
    unreadCount: vi.fn(),
    detail: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  };
  const users = { findMyCapabilities: vi.fn() };
  const controller = new NotificationInboxController(
    service as unknown as NotificationInboxService,
    users as unknown as UsersService,
  );
  const actor = 'authenticated-owner';
  const id = '11111111-1111-4111-8111-111111111111';
  const row = { id, readAt: null };

  beforeEach(() => vi.resetAllMocks());

  it('lists only the authenticated owner with the validated query', async () => {
    const query = { limit: '20', unread: 'true' as const };
    const result = { data: [row], nextCursor: null };
    service.list.mockResolvedValue(result);
    await expect(controller.list(actor, query)).resolves.toBe(result);
    expect(service.list).toHaveBeenCalledExactlyOnceWith(actor, query);
  });

  it('counts only the authenticated owner', async () => {
    const result = { count: 1 };
    service.unreadCount.mockResolvedValue(result);
    await expect(controller.unreadCount(actor, {})).resolves.toBe(result);
    expect(service.unreadCount).toHaveBeenCalledExactlyOnceWith(actor);
  });

  it('reads details using both authenticated owner and validated ID', async () => {
    service.detail.mockResolvedValue(row);
    await expect(controller.detail(actor, id, {})).resolves.toBe(row);
    expect(service.detail).toHaveBeenCalledExactlyOnceWith(actor, id);
  });

  it('marks a notification read using both authenticated owner and validated ID', async () => {
    const result = { ...row, readAt: new Date() };
    service.markRead.mockResolvedValue(result);
    await expect(controller.markRead(actor, id, {})).resolves.toBe(result);
    expect(service.markRead).toHaveBeenCalledExactlyOnceWith(actor, id);
  });

  it('marks all read for only the authenticated owner and returns no content', async () => {
    service.markAllRead.mockResolvedValue(undefined);
    await expect(controller.markAllRead(actor, {})).resolves.toBeUndefined();
    expect(service.markAllRead).toHaveBeenCalledExactlyOnceWith(actor);
  });
  it('rejects mismatched cache-owner fences before any service call', () => {
    expect(() => controller.list(actor, {}, 'different')).toThrow('Notification account changed');
    expect(() => controller.unreadCount(actor, {}, 'different')).toThrow(
      'Notification account changed',
    );
    expect(() => controller.detail(actor, id, {}, 'different')).toThrow(
      'Notification account changed',
    );
    expect(() => controller.markRead(actor, id, {}, 'different')).toThrow(
      'Notification account changed',
    );
    expect(() => controller.markAllRead(actor, {}, 'different')).toThrow(
      'Notification account changed',
    );
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });
  it('checks current trainer grant for every opt-in audience operation, without changing the recipient', async () => {
    users.findMyCapabilities.mockResolvedValue({ athlete: true, trainer: false, admin: false });
    const requests = [
      () => controller.list(actor, {}, actor, 'trainer'),
      () => controller.unreadCount(actor, {}, actor, 'trainer'),
      () => controller.detail(actor, id, {}, actor, 'trainer'),
      () => controller.markRead(actor, id, {}, actor, 'trainer'),
      () => controller.markAllRead(actor, {}, actor, 'trainer'),
    ];
    for (const request of requests)
      await expect(request()).rejects.toThrow('Current trainer approval is required');
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
    users.findMyCapabilities.mockResolvedValue({ athlete: true, trainer: true, admin: false });
    await Promise.all(requests.map((request) => request()));
    expect(service.list).toHaveBeenCalledWith(actor, {});
    expect(service.markRead).toHaveBeenCalledWith(actor, id);
    expect(() => controller.list(actor, {}, actor, 'admin')).toThrow(
      'Invalid notification audience',
    );
  });
});
