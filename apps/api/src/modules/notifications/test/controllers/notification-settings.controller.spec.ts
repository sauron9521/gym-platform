import type { NotificationSettingsService } from '../../public-api.js';
import { NotificationSettingsController } from '../../controllers/notification-settings.controller.js';

describe('NotificationSettingsController', () => {
  const get = vi.fn();
  const patch = vi.fn();
  const controller = new NotificationSettingsController({
    get,
    patch,
  } as unknown as NotificationSettingsService);
  const actor = { id: 'actor-1' };
  const expected = { quietHoursEnabled: false };

  beforeEach(() => vi.resetAllMocks());

  it('reads only the authenticated account', async () => {
    get.mockResolvedValue(expected);
    await expect(controller.get(actor, {})).resolves.toBe(expected);
    expect(get).toHaveBeenCalledExactlyOnceWith(actor.id);
  });

  it('forwards only the actor and validated partial settings', async () => {
    patch.mockResolvedValue(expected);
    const input = { quietHoursEnabled: false };
    await expect(controller.patch(actor, input, {})).resolves.toBe(expected);
    expect(patch).toHaveBeenCalledExactlyOnceWith(actor.id, input);
  });
});
