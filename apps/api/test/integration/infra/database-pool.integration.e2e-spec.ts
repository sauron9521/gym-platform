import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import type { AppEnv } from '../../../src/common/config/env.schema.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('PostgreSQL pool capacity and recovery', () => {
  it('bounds queued acquisition, preserves UTC, and recovers after releasing the sole connection', async () => {
    useTestDatabase();
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set('options', '-c timezone=Europe/Kyiv');
    const prisma = new PrismaService(
      new ConfigService<AppEnv, true>({
        DATABASE_URL: url.toString(),
        DATABASE_POOL_MAX: 1,
        DATABASE_POOL_CONNECT_TIMEOUT_MS: 500,
        DATABASE_POOL_IDLE_TIMEOUT_MS: 1_000,
      }),
    );
    let release!: () => void;
    let entered!: () => void;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await prisma.onModuleInit();
      const transaction = prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<
            Array<{ zone: string }>
          >`SELECT current_setting('TimeZone') AS zone`;
          entered();
          await hold;
          return rows;
        },
        { timeout: 15_000 },
      );
      try {
        await Promise.race([
          ready,
          transaction.then(() => {
            throw new Error('Transaction ended before acquisition');
          }),
        ]);
        await expect(prisma.$queryRaw`SELECT 1`).rejects.toThrow();
      } finally {
        release();
        expect(await transaction).toEqual([{ zone: 'UTC' }]);
      }
      expect(
        await prisma.$queryRaw<Array<{ zone: string }>>`SELECT current_setting('TimeZone') AS zone`,
      ).toEqual([{ zone: 'UTC' }]);
    } finally {
      await prisma.onApplicationShutdown();
    }
  }, 20_000);
  it('keeps PostgreSQL connected until an in-flight HTTP request finishes during app.close', async () => {
    useTestDatabase();
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prisma = new PrismaService(
      new ConfigService<AppEnv, true>({
        DATABASE_URL: process.env.DATABASE_URL!,
      }),
    );
    @Controller('drain-probe')
    class DrainProbeController {
      @Get()
      async read() {
        entered();
        await hold;
        await prisma.$queryRaw`SELECT 1`;
        return { ok: true };
      }
    }
    const module = await Test.createTestingModule({
      controllers: [DrainProbeController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();
    const app = module.createNestApplication();
    const disconnect = vi.spyOn(prisma, '$disconnect');
    let closing: Promise<void> | undefined;
    try {
      await app.listen(0, '127.0.0.1');
      const response = fetch((await app.getUrl()) + '/drain-probe');
      await Promise.race([
        started,
        response.then(() => {
          throw new Error('Request ended before drain');
        }),
      ]);
      closing = app.close();
      await vi.waitFor(() => expect(app.getHttpServer().listening).toBe(false));
      expect(disconnect).not.toHaveBeenCalled();
      release();
      const result = await response;
      expect(result.status).toBe(200);
      expect(await result.json()).toEqual({ ok: true });
      await closing;
      expect(disconnect).toHaveBeenCalledOnce();
    } finally {
      release();
      await (closing ?? app.close());
      disconnect.mockRestore();
    }
  }, 20_000);
});
