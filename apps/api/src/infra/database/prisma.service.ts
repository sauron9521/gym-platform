import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestTimedPrismaPg } from './request-timed-prisma-pg.js';
import { PrismaClient } from '#prisma/client';
import type { AppConfigService } from '#src/common/config/app-config.types';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Inject(ConfigService) private readonly config: AppConfigService) {
    const adapter = new RequestTimedPrismaPg({
      connectionString: config.getOrThrow('DATABASE_URL'),
      max: config.get('DATABASE_POOL_MAX') ?? 10,
      connectionTimeoutMillis: config.get('DATABASE_POOL_CONNECT_TIMEOUT_MS') ?? 5_000,
      idleTimeoutMillis: config.get('DATABASE_POOL_IDLE_TIMEOUT_MS') ?? 10_000,
      onConnect: async (client) => {
        // Prisma sends timestamps without offsets. PostgreSQL must interpret them as UTC.
        await client.query("SET TIME ZONE 'UTC'");
      },
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log({
      event: 'DATABASE_POOL_CONFIGURED',
      maxConnections: this.config.get('DATABASE_POOL_MAX') ?? 10,
      connectTimeoutMs: this.config.get('DATABASE_POOL_CONNECT_TIMEOUT_MS') ?? 5_000,
      idleTimeoutMs: this.config.get('DATABASE_POOL_IDLE_TIMEOUT_MS') ?? 10_000,
    });
  }

  // Keep the pool alive through scheduler shutdown and HTTP transport drain.
  async onApplicationShutdown() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
