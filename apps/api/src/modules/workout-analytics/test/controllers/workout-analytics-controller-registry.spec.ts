import { MODULE_METADATA } from '@nestjs/common/constants';
import { WorkoutAnalyticsModule } from '../../workout-analytics.module.js';

describe('WorkoutAnalyticsModule controller registry', () => {
  it('registers no HTTP controllers after audience migration', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, WorkoutAnalyticsModule)).toEqual([]);
  });
});
