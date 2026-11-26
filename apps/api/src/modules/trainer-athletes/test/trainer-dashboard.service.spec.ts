import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { UsersService } from '#src/modules/users/public-api';
import { TrainerDashboardRepository } from '../repositories/trainer-dashboard.repository.js';
import { TrainerDashboardService } from '../services/trainer-dashboard.service.js';

const actor = { id: 'trainer-1', role: 'ATHLETE' as const };
const now = new Date('2026-11-20T14:30:00.000Z');

describe('Trainer dashboard overview capability boundary', () => {
  const users = { findMyCapabilities: vi.fn() };
  const repo = { countOverview: vi.fn() };
  const service = new TrainerDashboardService(
    users as unknown as UsersService,
    repo as unknown as TrainerDashboardRepository,
  );

  it('allows approved trainer capability even if the old session role is ATHLETE', async () => {
    users.findMyCapabilities.mockResolvedValueOnce({
      athlete: true,
      trainer: true,
      admin: false,
    });
    repo.countOverview.mockResolvedValueOnce({
      activeClients: 2,
      activeProgramAssignments: 3,
      completedProgramWorkouts30d: 5,
    });

    const result = await service.overview(actor, now);
    expect(users.findMyCapabilities).toHaveBeenCalledWith(actor.id);
    expect(repo.countOverview).toHaveBeenCalledWith(
      actor.id,
      new Date('2026-10-21T14:30:00.000Z'),
      now,
    );
    expect(result).toEqual({
      asOf: now,
      windowStart: new Date('2026-10-21T14:30:00.000Z'),
      activeClients: 2,
      activeProgramAssignments: 3,
      completedProgramWorkouts30d: 5,
    });
  });

  it.each([
    { athlete: true, trainer: false, admin: false },
    { athlete: false, trainer: false, admin: true },
    { athlete: true, trainer: true, admin: true },
  ])('rejects unapproved/admin grants before any private counts', async (grants) => {
    users.findMyCapabilities.mockResolvedValueOnce(grants);
    repo.countOverview.mockClear();
    await expect(service.overview(actor, now)).rejects.toThrow(ForbiddenException);
    expect(repo.countOverview).not.toHaveBeenCalled();
  });

  it('fails closed when the account is deleted or the capability lookup fails', async () => {
    users.findMyCapabilities.mockRejectedValueOnce(new NotFoundException());
    repo.countOverview.mockClear();
    await expect(service.overview(actor, now)).rejects.toThrow(NotFoundException);
    expect(repo.countOverview).not.toHaveBeenCalled();
  });
});

describe('Trainer individual-client progress permission boundary', () => {
  const users = { findMyCapabilities: vi.fn() };
  const repo = { countClientProgress: vi.fn() };
  const service = new TrainerDashboardService(
    users as unknown as UsersService,
    repo as unknown as TrainerDashboardRepository,
  );

  it('reads only the live trainer-owned relationship and a bounded 30-day window', async () => {
    users.findMyCapabilities.mockResolvedValueOnce({ athlete: true, trainer: true, admin: false });
    repo.countClientProgress.mockResolvedValueOnce({
      activeProgramAssignments: 1,
      completedProgramWorkouts30d: 3,
    });
    const result = await service.clientProgress(actor, 'relation1', now);
    expect(repo.countClientProgress).toHaveBeenCalledWith(
      actor.id,
      'relation1',
      new Date('2026-10-21T14:30:00.000Z'),
      now,
    );
    expect(result).toEqual({
      asOf: now,
      windowStart: new Date('2026-10-21T14:30:00.000Z'),
      activeProgramAssignments: 1,
      completedProgramWorkouts30d: 3,
    });
  });

  it.each([
    { athlete: true, trainer: false, admin: false },
    { athlete: false, trainer: false, admin: true },
    { athlete: true, trainer: true, admin: true },
  ])('rejects unauthorized client progress without issuing any SQL read', async (grants) => {
    users.findMyCapabilities.mockResolvedValueOnce(grants);
    repo.countClientProgress.mockClear();
    await expect(service.clientProgress(actor, 'relation1', now)).rejects.toThrow(
      ForbiddenException,
    );
    expect(repo.countClientProgress).not.toHaveBeenCalled();
  });

  it('returns the same 404 for all ineligible relation IDs', async () => {
    users.findMyCapabilities.mockResolvedValueOnce({ athlete: true, trainer: true, admin: false });
    repo.countClientProgress.mockResolvedValueOnce(null);
    await expect(service.clientProgress(actor, 'foreign', now)).rejects.toThrow(NotFoundException);
  });
});
