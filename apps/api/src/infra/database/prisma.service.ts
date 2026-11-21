import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '#prisma/client';
import type { AppConfigService } from '#src/common/config/app-config.types';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Inject(ConfigService) private readonly config: AppConfigService) {
    const adapter = new PrismaPg({
      connectionString: config.getOrThrow('DATABASE_URL'),
      onConnect: async (client) => {
        // Prisma sends timestamps without offsets. PostgreSQL must interpret them as UTC.
        await client.query("SET TIME ZONE 'UTC'");
      },
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
