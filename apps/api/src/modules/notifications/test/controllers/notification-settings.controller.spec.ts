import { NotificationSettingsRepository } from '../../repositories/notification-settings.repository.js';
import { NotificationSettingsService } from '../../services/notification-settings.service.js';
import { NotificationSettingsController } from '../../controllers/notification-settings.controller.js';
const id = 'actor-1';
const expected = { quietHoursEnabled: false };
describe('NotificationSettingsController and service', () => {
  it('uses only the authenticated actor and forwards partial updates', async () => {
    const repo = {
      get: vi.fn().mockResolvedValue(expected),
      patch: vi.fn().mockResolvedValue(expected),
    };
    const service = new NotificationSettingsService(
      repo as unknown as NotificationSettingsRepository,
    );
    const controller = new NotificationSettingsController(service);
    const patch = { quietHoursEnabled: false };
    await expect(controller.get({ id }, {})).resolves.toBe(expected);
    await expect(controller.patch({ id }, patch, {})).resolves.toBe(expected);
    expect(repo.get).toHaveBeenCalledExactlyOnceWith(id);
    expect(repo.patch).toHaveBeenCalledExactlyOnceWith(id, patch);
  });
});
