import { WorkoutAnalyticsController } from '../../controllers/workout-analytics.controller.js';
import type {
  WorkoutAnalyticsService,
  WorkoutAnalyticsQuery,
  WorkoutActor,
} from '../../public-api.js';

describe('WorkoutAnalyticsController', () => {
  const service = {
    summary: vi.fn(),
    personalRecords: vi.fn(),
    exercise: vi.fn(),
    previousSets: vi.fn(),
  };
  const athlete: WorkoutActor = { id: 'athlete-1', role: 'ATHLETE' };
  let controller: WorkoutAnalyticsController;

  beforeEach(() => {
    vi.resetAllMocks();
    controller = new WorkoutAnalyticsController(service as unknown as WorkoutAnalyticsService);
  });

  it('delegates summary with the current athlete and selected range', async () => {
    const query: WorkoutAnalyticsQuery = { range: '7d' };
    const response = { range: '7d', workoutCount: 3, daily: [] };
    service.summary.mockResolvedValue(response);

    await expect(controller.summary(athlete, query)).resolves.toBe(response);
    expect(service.summary).toHaveBeenCalledTimes(1);
    expect(service.summary).toHaveBeenCalledWith(athlete, query);
    expect(service.exercise).not.toHaveBeenCalled();
  });

  it('delegates lifetime personal records with the authenticated actor only', async () => {
    const response = { exerciseCount: 2, asOf: new Date() };
    service.personalRecords.mockResolvedValue(response);
    await expect(controller.personalRecords(athlete)).resolves.toBe(response);
    expect(service.personalRecords).toHaveBeenCalledExactlyOnceWith(athlete);
  });

  it('delegates exercise history with the original actor, ID and range', async () => {
    const query: WorkoutAnalyticsQuery = { range: '90d' };
    const exerciseId = '11111111-1111-4111-8111-111111111111';
    const response = { exerciseId, workoutCount: 2, daily: [] };
    service.exercise.mockResolvedValue(response);

    await expect(controller.exercise(athlete, exerciseId, query)).resolves.toBe(response);
    expect(service.exercise).toHaveBeenCalledTimes(1);
    expect(service.exercise).toHaveBeenCalledWith(athlete, exerciseId, query);
    expect(service.summary).not.toHaveBeenCalled();
  });

  it('delegates previous sets using the authenticated actor and exercise only', async () => {
    const exerciseId = '11111111-1111-4111-8111-111111111111';
    const response = { exerciseId, workoutCompletedAt: null, sets: [] };
    service.previousSets.mockResolvedValue(response);
    await expect(controller.previousSets(athlete, exerciseId, {})).resolves.toBe(response);
    expect(service.previousSets).toHaveBeenCalledExactlyOnceWith(athlete, exerciseId);
  });

  it('preserves errors from the service without exposing extra data', async () => {
    const error = new Error('Access denied');
    const query: WorkoutAnalyticsQuery = { range: '30d' };
    service.summary.mockRejectedValue(error);

    await expect(controller.summary(athlete, query)).rejects.toBe(error);
    expect(service.summary).toHaveBeenCalledTimes(1);
    expect(service.summary).toHaveBeenCalledWith(athlete, query);
  });
});
