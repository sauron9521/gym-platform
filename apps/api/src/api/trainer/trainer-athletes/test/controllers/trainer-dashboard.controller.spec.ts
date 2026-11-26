import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';

import { TrainerDashboardController } from '../../controllers/trainer-dashboard.controller.js';
import { TrainerDashboardService } from '#src/modules/trainer-athletes/public-api';

describe('TrainerDashboardController', () => {
  it('registers a read-only client-progress route with relationId', () => {
    const action = Object.getOwnPropertyDescriptor(
      TrainerDashboardController.prototype,
      'clientProgress',
    )?.value as (...args: unknown[]) => unknown;
    expect(Reflect.getMetadata(METHOD_METADATA, action)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, action)).toBe('clients/:relationId/progress');
  });

  it('registers one read-only overview route under the trainer-dashboard prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, TrainerDashboardController)).toBe(
      'trainer-dashboard',
    );
    const action = Object.getOwnPropertyDescriptor(TrainerDashboardController.prototype, 'overview')
      ?.value as (...args: unknown[]) => unknown;
    expect(Reflect.getMetadata(METHOD_METADATA, action)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, action)).toBe('overview');
  });

  it('forwards only authenticated identity to the capability-checked service', async () => {
    const overview = vi.fn().mockResolvedValue({
      activeClients: 2,
      activeProgramAssignments: 1,
      completedProgramWorkouts30d: 3,
    });
    const module = await Test.createTestingModule({
      controllers: [TrainerDashboardController],
      providers: [{ provide: TrainerDashboardService, useValue: { overview } }],
    }).compile();
    const controller = module.get(TrainerDashboardController);
    const user = { id: 'u1', role: 'ATHLETE' as const };
    expect(await controller.overview(user)).toMatchObject({ activeClients: 2 });
    expect(overview).toHaveBeenCalledOnce();
    expect(overview).toHaveBeenCalledWith(user);
    await module.close();
  });
  it('passes both authenticated identity and relationship ID to the service', async () => {
    const clientProgress = vi.fn().mockResolvedValue({ activeProgramAssignments: 1 });
    const module = await Test.createTestingModule({
      controllers: [TrainerDashboardController],
      providers: [{ provide: TrainerDashboardService, useValue: { clientProgress } }],
    }).compile();
    const user = { id: 'trainer1', role: 'ATHLETE' as const };
    expect(await module.get(TrainerDashboardController).clientProgress(user, 'r1')).toEqual({
      activeProgramAssignments: 1,
    });
    expect(clientProgress).toHaveBeenCalledWith(user, 'r1');
    await module.close();
  });
});
