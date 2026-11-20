import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { WorkoutActor } from '#src/modules/workouts/types/workout.types';

import { UsersService } from '#src/modules/users/services/users.service';
import { WorkoutAnalyticsRepository } from '../repositories/workout-analytics.repository.js';
import { WorkoutAnalyticsService } from '../services/workout-analytics.service.js';

describe('WorkoutAnalyticsService', () => {
  const athlete = { id: 'athlete-1', role: 'ATHLETE' } as WorkoutActor;
  const trainer = { id: 'trainer-1', role: 'TRAINER' } as WorkoutActor;
  const oldAdminSession = { id: 'admin-1', role: 'ATHLETE' } as WorkoutActor;
  const users = { findMyCapabilities: vi.fn() };
  const repository = {
    readSummary: vi.fn(),
    readExercise: vi.fn(),
    readPersonalRecords: vi.fn(),
  };
  const service = new WorkoutAnalyticsService(
    repository as unknown as WorkoutAnalyticsRepository,
    users as unknown as UsersService,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    users.findMyCapabilities.mockImplementation(async (id: string) => ({
      athlete: id !== oldAdminSession.id,
      trainer: id === trainer.id,
      admin: id === oldAdminSession.id,
    }));
  });

  it('aggregates per-day workout counts, completed sets and actual strength volume', async () => {
    repository.readSummary.mockResolvedValue([
      { date: '2026-11-07', workoutCount: 2, completedSets: 3, strengthVolumeKg: '1084.00' },
      { date: '2026-11-08', workoutCount: 1, completedSets: 1, strengthVolumeKg: '350.00' },
    ]);

    const result = await service.summary(athlete, { range: '7d' });
    expect(result).toMatchObject({
      range: '7d',
      workoutCount: 3,
      activeDays: 2,
      completedSets: 4,
      strengthVolumeKg: 1434,
    });
    expect(result.daily).toHaveLength(2);
    expect(repository.readSummary).toHaveBeenCalledWith(
      athlete.id,
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('returns an empty summary without reporting fictitious activity', async () => {
    repository.readSummary.mockResolvedValue([]);
    const result = await service.summary(athlete, { range: '30d' });
    expect(result).toMatchObject({
      workoutCount: 0,
      activeDays: 0,
      completedSets: 0,
      strengthVolumeKg: 0,
      daily: [],
    });
  });

  it('computes best actual weight rather than a 1RM estimate', async () => {
    repository.readExercise.mockResolvedValue({
      name: 'Bench Press',
      days: [
        {
          date: '2026-11-07',
          workoutCount: 2,
          completedSets: 2,
          strengthReps: 18,
          strengthVolumeKg: '1084.00',
          bestWeightKg: '60.50',
        },
        {
          date: '2026-11-08',
          workoutCount: 1,
          completedSets: 1,
          strengthReps: 5,
          strengthVolumeKg: '350.00',
          bestWeightKg: '70.00',
        },
      ],
    });
    const result = await service.exercise(athlete, 'exercise-1', { range: '30d' });
    expect(result).toMatchObject({
      exerciseId: 'exercise-1',
      name: 'Bench Press',
      workoutCount: 3,
      completedSets: 3,
      strengthReps: 23,
      strengthVolumeKg: 1434,
      bestWeightKg: 70,
    });
  });

  it('does not reveal an unknown or inaccessible exercise', async () => {
    repository.readExercise.mockResolvedValue({ name: null, days: [] });
    const result = await service.exercise(athlete, 'unknown', { range: '7d' });
    expect(result).toMatchObject({
      name: null,
      workoutCount: 0,
      completedSets: 0,
      bestWeightKg: null,
      daily: [],
    });
  });

  it('returns a lifetime per-exercise record count only from the authenticated athlete', async () => {
    repository.readPersonalRecords.mockResolvedValue([{ exerciseCount: 2 }]);
    const result = await service.personalRecords(athlete);
    expect(result).toMatchObject({ exerciseCount: 2, asOf: expect.any(Date) });
    expect(repository.readPersonalRecords).toHaveBeenCalledWith(athlete.id, expect.any(Date));
  });

  it('returns zero for an empty verified record history', async () => {
    repository.readPersonalRecords.mockResolvedValue([{ exerciseCount: 0 }]);
    const result = await service.personalRecords(athlete);
    expect(result.exerciseCount).toBe(0);
  });

  it('allows legacy TRAINER accounts to use their personal athlete analytics', async () => {
    repository.readSummary.mockResolvedValue([]);
    repository.readPersonalRecords.mockResolvedValue([]);
    repository.readExercise.mockResolvedValue({ name: null, days: [] });

    await service.summary(trainer, { range: '30d' });
    await service.personalRecords(trainer);
    await service.exercise(trainer, 'exercise-1', { range: '30d' });

    expect(users.findMyCapabilities).toHaveBeenCalledWith(trainer.id);
    expect(repository.readSummary).toHaveBeenCalledOnce();
    expect(repository.readPersonalRecords).toHaveBeenCalledOnce();
    expect(repository.readExercise).toHaveBeenCalledOnce();
  });

  it('denies admins with an old ATHLETE session before any analytics query', async () => {
    await expect(service.summary(oldAdminSession, { range: '30d' })).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.personalRecords(oldAdminSession)).rejects.toThrow(ForbiddenException);
    await expect(service.exercise(oldAdminSession, 'exercise-1', { range: '30d' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(repository.readSummary).not.toHaveBeenCalled();
    expect(repository.readPersonalRecords).not.toHaveBeenCalled();
    expect(repository.readExercise).not.toHaveBeenCalled();
  });
});
