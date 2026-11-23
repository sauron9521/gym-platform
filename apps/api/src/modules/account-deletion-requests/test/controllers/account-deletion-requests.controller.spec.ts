import { AccountDeletionRequestsController } from '../../controllers/account-deletion-requests.controller.js';
import type { AccountDeletionRequestsService } from '../../services/account-deletion-requests.service.js';

describe('AccountDeletionRequestsController', () => {
  const service = { findOwn: vi.fn(), submit: vi.fn() };
  const controller = new AccountDeletionRequestsController(
    service as unknown as AccountDeletionRequestsService,
  );

  it('scopes the status read to the authenticated user', async () => {
    const status = { request: null };
    service.findOwn.mockResolvedValue(status);
    await expect(controller.findOwn('current-user')).resolves.toBe(status);
    expect(service.findOwn).toHaveBeenCalledExactlyOnceWith('current-user');
  });

  it('forwards the authenticated user and validated confirmation to the service', async () => {
    const input = { confirm: true as const, password: 'CurrentPassword!' };
    const result = { request: { id: 'receipt-1', status: 'REQUESTED', requestedAt: new Date() } };
    service.submit.mockResolvedValue(result);
    await expect(controller.submit('current-user', input)).resolves.toBe(result);
    expect(service.submit).toHaveBeenCalledExactlyOnceWith('current-user', input);
  });
});
