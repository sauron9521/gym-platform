import { MODULE_METADATA } from '@nestjs/common/constants';
import { NotificationsModule } from '../../notifications.module.js';

describe('NotificationsModule controller registry', () => {
  it('registers no HTTP controllers after the audience migration', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, NotificationsModule)).toEqual([]);
  });
});
