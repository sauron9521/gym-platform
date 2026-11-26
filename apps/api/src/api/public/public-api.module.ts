import { Module } from '@nestjs/common';

import { PublicAuthApiModule } from './auth/public-auth-api.module.js';
import { PublicUsersApiModule } from './users/public-users-api.module.js';

@Module({ imports: [PublicUsersApiModule, PublicAuthApiModule] })
export class PublicApiModule {}
