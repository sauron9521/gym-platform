import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TrainerReviewController } from '../../controllers/trainer-review.controller.js';
import type { TrainerReviewService } from '../../services/trainer-review.service.js';

describe('TrainerReviewController', () => {
  const service = { findPending: vi.fn(), decide: vi.fn() };
  const controller = new TrainerReviewController(service as unknown as TrainerReviewService);
  const actor = { id: 'operator', role: 'ADMIN' } as const;
  const input = { reason: 'Verified supporting qualifications' };

  beforeEach(() => vi.resetAllMocks());

  it('forwards the authenticated operator for a pending queue', async () => {
    service.findPending.mockResolvedValue([]);
    await expect(controller.findPending(actor)).resolves.toEqual([]);
    expect(service.findPending).toHaveBeenCalledWith(actor);
  });

  it.each([
    ['approve', 'APPROVE'],
    ['reject', 'REJECT'],
    ['revoke', 'REVOKE'],
  ] as const)('%s passes only server-authenticated actor and reviewed decision', async (method, action) => {
    service.decide.mockResolvedValue({ id: 'application', status: action });
    await controller[method]('application', actor, input);
    expect(service.decide).toHaveBeenCalledWith('application', actor, action, input);
  });
});
