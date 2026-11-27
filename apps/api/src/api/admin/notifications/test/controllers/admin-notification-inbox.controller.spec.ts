import type { AdminNotificationInboxService } from '#src/modules/notifications/public-api';
import { AdminNotificationInboxController } from '../../controllers/admin-notification-inbox.controller.js';

describe('AdminNotificationInboxController', () => {
  it('forwards only the authenticated identity, validated query and notification ID', async () => {
    const service = {
      list: vi.fn(),
      unreadCount: vi.fn(),
      detail: vi.fn(),
      markRead: vi.fn(),
      markAllRead: vi.fn(),
    };
    const controller = new AdminNotificationInboxController(
      service as unknown as AdminNotificationInboxService,
    );
    await controller.list('operator', { limit: '10' });
    await controller.unreadCount('operator', {});
    await controller.detail('operator', 'notice', {});
    await controller.markRead('operator', 'notice', {});
    await controller.markAllRead('operator', {});
    expect(service.list).toHaveBeenCalledExactlyOnceWith('operator', { limit: '10' });
    expect(service.unreadCount).toHaveBeenCalledExactlyOnceWith('operator');
    expect(service.detail).toHaveBeenCalledExactlyOnceWith('operator', 'notice');
    expect(service.markRead).toHaveBeenCalledExactlyOnceWith('operator', 'notice');
    expect(service.markAllRead).toHaveBeenCalledExactlyOnceWith('operator');
  });
});
