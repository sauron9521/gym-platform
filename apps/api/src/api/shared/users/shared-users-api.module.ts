import { Module } from '@nestjs/common';

import { UsersModule } from '#src/modules/users/users.module';
import { UsersController } from './controllers/users.controller.js';

@Module({
  imports: [UsersModule],
  controllers: [UsersController],
})
export class SharedUsersApiModule {}
