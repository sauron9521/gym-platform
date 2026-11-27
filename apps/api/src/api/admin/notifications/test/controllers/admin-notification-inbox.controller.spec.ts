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
  it('rejects expected owner mismatch before all service calls', () => {
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
    for (const action of [
      () => controller.list('operator', {}, 'other'),
      () => controller.unreadCount('operator', {}, 'other'),
      () => controller.detail('operator', 'notice', {}, 'other'),
      () => controller.markRead('operator', 'notice', {}, 'other'),
      () => controller.markAllRead('operator', {}, 'other'),
    ])
      expect(action).toThrow('Notification account changed');
    for (const method of Object.values(service)) expect(method).not.toHaveBeenCalled();
  });
});
