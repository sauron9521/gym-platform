import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';

import { TrainerApplicationsService } from '../services/trainer-applications.service.js';
import type { TrainerApplicationsRepository } from '../repositories/trainer-applications.repository.js';

describe('TrainerApplicationsService', () => {
  const repository = {
    findApplicant: vi.fn(),
    findLatest: vi.fn(),
    findBlocking: vi.fn(),
    findPendingId: vi.fn(),
    create: vi.fn(),
    updatePending: vi.fn(),
  };

  const service = new TrainerApplicationsService(
    repository as unknown as TrainerApplicationsRepository,
  );
  const note = { applicantNote: 'I train athletes and coach strength.' };

  beforeEach(() => {
    vi.resetAllMocks();
    repository.findApplicant.mockResolvedValue({
      id: 'owner',
      role: 'ATHLETE',
      emailVerified: true,
      trainerProfile: null,
    });
  });

  it('returns owner-scoped latest or null without granting access', async () => {
    repository.findLatest.mockResolvedValue(null);
    await expect(service.findMine('owner')).resolves.toBeNull();
    expect(repository.findLatest).toHaveBeenCalledWith('owner');
  });

  it('rejects stale accounts and unverified or privileged accounts', async () => {
    repository.findApplicant.mockResolvedValueOnce(null);
    await expect(service.submit('owner', note)).rejects.toThrow(UnauthorizedException);

    for (const user of [
      { id: 'owner', role: 'ADMIN', emailVerified: true, trainerProfile: null },
      { id: 'owner', role: 'TRAINER', emailVerified: true, trainerProfile: null },
      { id: 'owner', role: 'ATHLETE', emailVerified: true, trainerProfile: { isActive: true } },
      { id: 'owner', role: 'ATHLETE', emailVerified: false, trainerProfile: null },
    ]) {
      repository.findApplicant.mockResolvedValueOnce(user);
      await expect(service.submit('owner', note)).rejects.toThrow(ForbiddenException);
    }
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects pending or approved requests and does not write new rows', async () => {
    repository.findBlocking.mockResolvedValue({ id: 'existing', status: 'APPROVED' });
    await expect(service.submit('owner', note)).rejects.toThrow(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('submits a new application solely for the authenticated owner', async () => {
    repository.findBlocking.mockResolvedValue(null);
    repository.create.mockResolvedValue({ id: 'new', status: 'PENDING' });
    expect(await service.submit('owner', note)).toMatchObject({ status: 'PENDING' });
    expect(repository.create).toHaveBeenCalledWith('owner', note.applicantNote);
  });

  it('updates only a pending owner row and fails closed after a race', async () => {
    repository.findPendingId.mockResolvedValue({ id: 'pending' });
    repository.updatePending.mockResolvedValue({ id: 'pending', status: 'PENDING' });
    await expect(service.updateMine('owner', note)).resolves.toMatchObject({ id: 'pending' });
    expect(repository.updatePending).toHaveBeenCalledWith('owner', 'pending', note.applicantNote);

    repository.updatePending.mockResolvedValueOnce(null);
    await expect(service.updateMine('owner', note)).rejects.toThrow(ConflictException);
  });

  it('rejects editing when there is no pending application', async () => {
    repository.findPendingId.mockResolvedValue(null);
    await expect(service.updateMine('owner', note)).rejects.toThrow(ConflictException);
    expect(repository.updatePending).not.toHaveBeenCalled();
  });
});
