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
  const controller = new NotificationInboxController(
    service as unknown as NotificationInboxService,
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
});
