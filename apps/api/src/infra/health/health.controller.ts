import { Public } from '@nestjs/authentication';
import { Controller, Get, ServiceUnavailableException, type OnModuleDestroy } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';

import { PrismaService } from '#src/infra/database/index';
import { DistributedThrottlerStorage } from '#src/common/rate-limit/distributed-throttler.storage';

/** Liveness is dependency-free; readiness checks PostgreSQL and throttling. */
@Public()
@SkipThrottle()
@ApiTags('Health')
@Controller('health')
export class HealthController implements OnModuleDestroy {
  private draining = false;
  private probe: Promise<boolean> | undefined;

  onModuleDestroy(): void {
    this.draining = true;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly throttleStorage: DistributedThrottlerStorage,
  ) {}

  @Get('live')
  liveness() {
    return { status: 'ok' as const };
  }

  private checkDependencies(): Promise<boolean> {
    // Share one deadline and one underlying probe. Once timed out, return
    // the same negative result until both dependencies actually settle.
    // This avoids accumulating handlers on a permanently stalled query.
    if (this.probe) return this.probe;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const dependencies = Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.throttleStorage.checkReadiness(),
    ]).then(
      ([database, throttling]) =>
        database.status === 'fulfilled' &&
        Boolean(database.value) &&
        throttling.status === 'fulfilled' &&
        throttling.value,
    );
    this.probe = Promise.race([
      dependencies,
      new Promise<false>((resolve) => {
        timeout = setTimeout(() => resolve(false), 5_000);
      }),
    ]);
    void dependencies.finally(() => {
      clearTimeout(timeout);
      this.probe = undefined;
    });
    return this.probe;
  }

  @Get('ready')
  async readiness() {
    if (this.draining) throw new ServiceUnavailableException('Service unavailable');
    try {
      if (!(await this.checkDependencies()) || this.draining) {
        throw new Error('Dependency not ready');
      }
      return { status: 'ok' as const };
    } catch {
      throw new ServiceUnavailableException('Service unavailable');
    }
  }
}
