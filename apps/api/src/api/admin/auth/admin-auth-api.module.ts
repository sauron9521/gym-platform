import { Module } from '@nestjs/common';
import { AuthModule } from '#src/modules/auth/auth.module';
import { AdminAuthController } from './controllers/admin-auth.controller.js';

@Module({ imports: [AuthModule], controllers: [AdminAuthController] })
export class AdminAuthApiModule {}
