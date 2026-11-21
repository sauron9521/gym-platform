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

describe('Trainer dashboard individual client SQL scope', () => {
  it('executes one bounded relationship lookup and two owner-scoped counts', async () => {
    const trainerAthlete = { findFirst: vi.fn().mockResolvedValue({ id: 'r1' }) };
    const trainingProgramAssignment = { count: vi.fn().mockResolvedValue(2) };
    const workout = { count: vi.fn().mockResolvedValue(4) };
    const $transaction = vi.fn(async (reads: Promise<unknown>[]) => Promise.all(reads));
    const db = { trainerAthlete, trainingProgramAssignment, workout, $transaction };
    const repo = new TrainerDashboardRepository(db as unknown as PrismaService);
    const from = new Date('2026-10-22T12:00:00Z');
    const now = new Date('2026-11-21T12:00:00Z');
    expect(await repo.countClientProgress('trainer1', 'r1', from, now)).toEqual({
      activeProgramAssignments: 2,
      completedProgramWorkouts30d: 4,
    });
    expect($transaction).toHaveBeenCalledOnce();
    expect($transaction.mock.calls[0]?.[0]).toHaveLength(3);
    const relation = {
      id: 'r1',
      trainerId: 'trainer1',
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
    expect(trainerAthlete.findFirst).toHaveBeenCalledWith({
      where: relation,
      select: { id: true },
    });
    expect(trainingProgramAssignment.count).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        trainerAthlete: { is: relation },
        version: { is: { program: { is: { trainerId: 'trainer1' } } } },
      },
    });
    expect(workout.count).toHaveBeenCalledWith({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: from, lt: now },
        programAssignment: {
          is: {
            status: { in: ['ACTIVE', 'COMPLETED'] },
            trainerAthlete: { is: relation },
            version: { is: { program: { is: { trainerId: 'trainer1' } } } },
          },
        },
      },
    });
  });

  it('does not disclose counts for missing or ended relationships', async () => {
    const db = {
      trainerAthlete: { findFirst: vi.fn().mockResolvedValue(null) },
      trainingProgramAssignment: { count: vi.fn().mockResolvedValue(9) },
      workout: { count: vi.fn().mockResolvedValue(16) },
      $transaction: async (reads: Promise<unknown>[]) => Promise.all(reads),
    };
    const repo = new TrainerDashboardRepository(db as unknown as PrismaService);
    expect(
      await repo.countClientProgress('trainer1', 'foreign', new Date(0), new Date()),
    ).toBeNull();
  });
});
