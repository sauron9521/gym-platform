import { MODULE_METADATA } from '@nestjs/common/constants';
import { TrainerOnboardingModule } from '../../trainer-onboarding.module.js';

describe('TrainerOnboardingModule controller registry', () => {
  it('registers no HTTP controllers after the audience migration', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, TrainerOnboardingModule)).toEqual([]);
  });
});
