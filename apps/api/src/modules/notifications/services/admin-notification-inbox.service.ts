import { Injectable } from '@nestjs/common';
import type { AdminNotificationInboxQuery } from '../domain/notification-inbox.policy.js';
import { AdminNotificationInboxRepository } from '../repositories/admin-notification-inbox.repository.js';

@Injectable()
export class AdminNotificationInboxService {
  constructor(private readonly repository: AdminNotificationInboxRepository) {}
  list(id: string, query: AdminNotificationInboxQuery) {
    return this.repository.list(id, query);
  }
  unreadCount(id: string) {
    return this.repository.unreadCount(id);
  }
  detail(id: string, notificationId: string) {
    return this.repository.detail(id, notificationId);
  }
  markRead(id: string, notificationId: string) {
    return this.repository.markRead(id, notificationId);
  }
  markAllRead(id: string) {
    return this.repository.markAllRead(id);
  }
}
