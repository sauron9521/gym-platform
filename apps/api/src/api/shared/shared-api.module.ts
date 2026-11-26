import { Module } from '@nestjs/common';

import { SharedUsersApiModule } from './users/shared-users-api.module.js';

@Module({ imports: [SharedUsersApiModule] })
export class SharedApiModule {}
