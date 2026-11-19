import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TrainerApplicationsController } from '../../controllers/trainer-applications.controller.js';
import { TrainerApplicationsService } from '../../services/trainer-applications.service.js';

describe('TrainerApplicationsController', () => {
  const service = {
    findMine: vi.fn(),
    submit: vi.fn(),
    updateMine: vi.fn(),
  };
  const controller = new TrainerApplicationsController(
    service as unknown as TrainerApplicationsService,
  );
  const actor = { id: 'authenticated-owner' };
  const input = { applicantNote: 'I coach and create personalized training programs.' };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('reads only the authenticated account applications', async () => {
    service.findMine.mockResolvedValue(null);
    await expect(controller.findMine(actor)).resolves.toEqual({ application: null });
    expect(service.findMine).toHaveBeenCalledWith(actor.id);
  });

  it('submits only the authenticated owner and validated text', async () => {
    service.submit.mockResolvedValue({ id: 'submitted', status: 'PENDING' });
    await expect(controller.submit(actor, input)).resolves.toMatchObject({ status: 'PENDING' });
    expect(service.submit).toHaveBeenCalledWith(actor.id, input);
  });

  it('edits only the pending application owned by the authenticated user', async () => {
    service.updateMine.mockResolvedValue({ id: 'submitted', status: 'PENDING' });
    await controller.updateMine(actor, input);
    expect(service.updateMine).toHaveBeenCalledWith(actor.id, input);
  });
});
