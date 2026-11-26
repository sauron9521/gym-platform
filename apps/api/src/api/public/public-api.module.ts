import { Module } from '@nestjs/common';

import { PublicUsersApiModule } from './users/public-users-api.module.js';

@Module({ imports: [PublicUsersApiModule] })
export class PublicApiModule {}
