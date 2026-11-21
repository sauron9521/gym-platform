import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '#src/infra/database/index';
import { TrainerDashboardRepository } from '../repositories/trainer-dashboard.repository.js';

describe('Trainer dashboard bounded SQL aggregates', () => {
  it('issues exactly 3 scoped count queries, no per-athlete queries or row fetches', async () => {
    const trainerAthlete = { count: vi.fn().mockResolvedValue(2) };
    const trainingProgramAssignment = { count: vi.fn().mockResolvedValue(3) };
    const workout = { count: vi.fn().mockResolvedValue(4) };
    const $transaction = vi.fn(async (operations: Promise<number>[]) => Promise.all(operations));
    const prisma = { trainerAthlete, trainingProgramAssignment, workout, $transaction };
    const repo = new TrainerDashboardRepository(prisma as unknown as PrismaService);
    const from = new Date('2026-10-21T00:00:00.000Z');
    const asOf = new Date('2026-11-20T00:00:00.000Z');

    const result = await repo.countOverview('t1', from, asOf);
    expect(result).toEqual({
      activeClients: 2,
      activeProgramAssignments: 3,
      completedProgramWorkouts30d: 4,
    });
    expect($transaction).toHaveBeenCalledTimes(1);
    expect($transaction.mock.calls[0]?.[0]).toHaveLength(3);
    expect(trainerAthlete.count).toHaveBeenCalledTimes(1);
    expect(trainingProgramAssignment.count).toHaveBeenCalledTimes(1);
    expect(workout.count).toHaveBeenCalledTimes(1);
    const scope = {
      trainerId: 't1',
      status: 'ACTIVE',
      trainer: {
        is: {
          deletedAt: null,
          role: { not: 'ADMIN' },
          OR: [
            { trainerProfile: { is: { isActive: true } } },
            { role: 'TRAINER', trainerProfile: { is: null } },
          ],
        },
      },
      athlete: { is: { deletedAt: null, role: { not: 'ADMIN' } } },
    };
    expect(trainerAthlete.count).toHaveBeenCalledWith({ where: scope });
    expect(trainingProgramAssignment.count).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        trainerAthlete: { is: scope },
        version: { is: { program: { is: { trainerId: 't1' } } } },
      },
    });
    expect(workout.count).toHaveBeenCalledWith({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: from, lt: asOf },
        programAssignment: {
          is: {
            status: { in: ['ACTIVE', 'COMPLETED'] },
            trainerAthlete: { is: scope },
            version: { is: { program: { is: { trainerId: 't1' } } } },
          },
        },
      },
    });
  });
});
