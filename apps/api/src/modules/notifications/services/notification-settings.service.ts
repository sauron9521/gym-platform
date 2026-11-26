import { Injectable } from '@nestjs/common';
import { NotificationSettingsRepository } from '../repositories/notification-settings.repository.js';
import type { NotificationSettingsPatch } from '../domain/notification-settings.policy.js';

@Injectable()
export class NotificationSettingsService {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  get(userId: string) {
    return this.repository.get(userId);
  }

  patch(userId: string, patch: NotificationSettingsPatch) {
    return this.repository.patch(userId, patch);
  }
}
