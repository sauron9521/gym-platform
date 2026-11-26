import { NotificationSettingsRepository } from '../repositories/notification-settings.repository.js';
import { NotificationSettingsService } from '../services/notification-settings.service.js';
const id = 'actor-1';
const expected = { quietHoursEnabled: false };
describe('NotificationSettingsService', () => {
  it('uses only the authenticated actor and forwards partial updates', async () => {
    const repo = {
      get: vi.fn().mockResolvedValue(expected),
      patch: vi.fn().mockResolvedValue(expected),
    };
    const service = new NotificationSettingsService(
      repo as unknown as NotificationSettingsRepository,
    );
    const patch = { quietHoursEnabled: false };
    await expect(service.get(id)).resolves.toBe(expected);
    await expect(service.patch(id, patch)).resolves.toBe(expected);
    expect(repo.get).toHaveBeenCalledExactlyOnceWith(id);
    expect(repo.patch).toHaveBeenCalledExactlyOnceWith(id, patch);
  });
});
