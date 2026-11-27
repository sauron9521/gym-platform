import { Injectable } from '@nestjs/common';
import type { NotificationInboxQuery } from '../domain/notification-inbox.policy.js';
import { NotificationInboxRepository } from '../repositories/notification-inbox.repository.js';

@Injectable()
export class NotificationInboxService {
  constructor(private readonly repository: NotificationInboxRepository) {}
  list(userId: string, query: NotificationInboxQuery) {
    return this.repository.list(userId, query);
  }
  unreadCount(userId: string) {
    return this.repository.unreadCount(userId);
  }
  detail(userId: string, id: string) {
    return this.repository.detail(userId, id);
  }
  markRead(userId: string, id: string) {
    return this.repository.markRead(userId, id);
  }
  markAllRead(userId: string) {
    return this.repository.markAllRead(userId);
  }
}
