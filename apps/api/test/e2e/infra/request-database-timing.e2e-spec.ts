import { Controller, Get, Inject, Logger, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../src/infra/database/prisma.service.js';
import { RequestContextMiddleware } from '../../../src/common/request-context/request-context.middleware.js';
import { ApiExceptionFilter } from '../../../src/common/filters/api-exception.filter.js';
import { HttpMetricsRegistry } from '../../../src/common/http-metrics/http-metrics.registry.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

const marker = 'synthetic-private-bind@example.test';

@Controller('timing-fixture')
class TimingController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('single')
  async single() {
    await this.prisma.$queryRaw`SELECT ${marker}::text AS value FROM pg_sleep(0.03)`;
    return { ok: true };
  }

  @Get('transaction')
  async transaction() {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
      await tx.$queryRaw`SELECT 1::int AS value`;
    });
    return { ok: true };
  }

  @Get('failure')
  async failure() {
    await this.prisma.$queryRaw`SELECT 1 / 0 AS value`;
    return { ok: true };
  }

  @Get('none')
  none() {
    return { ok: true };
  }
}

describe('database timing correlation with real HTTP and PostgreSQL', () => {
  let app: INestApplication;
  const metrics = new HttpMetricsRegistry();
  beforeAll(async () => {
    useTestDatabase();
    const module = await Test.createTestingModule({
      controllers: [TimingController],
      providers: [
        PrismaService,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            DATABASE_URL: process.env.TEST_DATABASE_URL,
            DATABASE_POOL_MAX: 4,
          }),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    const middleware = new RequestContextMiddleware(metrics);
    app.use((req: Request, res: Response, next: NextFunction) => middleware.use(req, res, next));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  }, 30_000);
  afterAll(async () => {
    await app?.close();
  });

  it('isolates concurrent query and transaction timing and correlates safe error logs to server IDs', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const [one, two, none, failed] = await Promise.all([
        request(app.getHttpServer())
          .get('/timing-fixture/single')
          .set('X-Request-ID', 'forged-secret')
          .expect(200),
        request(app.getHttpServer()).get('/timing-fixture/transaction').expect(200),
        request(app.getHttpServer()).get('/timing-fixture/none').expect(200),
        request(app.getHttpServer()).get('/timing-fixture/failure').expect(500),
      ]);
      const records = log.mock.calls
        .filter(([message]) => message === 'HTTP request completed')
        .map((call) => call[1] as Record<string, unknown>);
      const id = (response: typeof one): string => String(response.headers['x-request-id']);
      const byId = (response: typeof one) => records.find((row) => row.requestId === id(response));
      expect(new Set([one, two, none, failed].map(id)).size).toBe(4);
      expect(byId(one)).toMatchObject({
        databaseCallsStarted: 1,
        databaseCallsCompleted: 1,
        databaseCallsFailed: 0,
        statusCode: 200,
      });
      expect(Number(byId(one)?.databaseCallMaxMs)).toBeGreaterThanOrEqual(20);
      // The adapter also sees the COMMIT issued by the Prisma runtime.
      expect(byId(two)).toMatchObject({
        databaseCallsStarted: 3,
        databaseCallsCompleted: 3,
        databaseCallsFailed: 0,
        statusCode: 200,
      });
      expect(byId(none)).toMatchObject({
        databaseCallsStarted: 0,
        databaseCallsCompleted: 0,
        databaseCallsFailed: 0,
      });
      expect(byId(failed)).toMatchObject({
        databaseCallsStarted: 1,
        databaseCallsCompleted: 1,
        databaseCallsFailed: 1,
        statusCode: 500,
      });
      expect(failed.body.requestId).toBe(id(failed));
      expect(JSON.stringify(error.mock.calls)).toContain(id(failed));
      expect(JSON.stringify(records)).not.toMatch(
        /synthetic-private-bind|forged-secret|SELECT|statement_timeout|pg_sleep/,
      );
      expect(metrics.render()).not.toMatch(/request_id=|databaseCall|synthetic-private-bind/);
      expect(one.body).toEqual({ ok: true });
      expect(two.body).toEqual({ ok: true });
      expect(failed.text).not.toContain('division by zero');
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });
});
