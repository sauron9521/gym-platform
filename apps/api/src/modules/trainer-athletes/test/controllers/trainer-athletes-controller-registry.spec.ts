import { MODULE_METADATA } from '@nestjs/common/constants';
import { TrainerAthletesModule } from '../../trainer-athletes.module.js';

describe('TrainerAthletesModule controller registry', () => {
  it('registers no HTTP controllers after both audience migrations', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, TrainerAthletesModule)).toEqual([]);
  });
});
