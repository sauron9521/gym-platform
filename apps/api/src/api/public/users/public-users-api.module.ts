import { Module } from '@nestjs/common';

import { UsersModule } from '#src/modules/users/users.module';
import { AvatarPublicController } from './controllers/avatar-public.controller.js';

@Module({
  imports: [UsersModule],
  controllers: [AvatarPublicController],
})
export class PublicUsersApiModule {}
