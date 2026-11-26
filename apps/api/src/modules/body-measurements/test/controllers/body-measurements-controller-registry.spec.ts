import { MODULE_METADATA } from '@nestjs/common/constants';
import { BodyMeasurementsModule } from '../../body-measurements.module.js';

describe('BodyMeasurementsModule controller registry', () => {
  it('registers no HTTP controllers after audience migration', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, BodyMeasurementsModule)).toEqual([]);
  });
});
