import { randomUUID } from 'node:crypto';

import { PasswordHasher } from '@nestjs/authentication';
import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '#prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../../src/infra/database/index.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

type Route = { key: string; path: string; actor: 'athlete' | 'trainer' };
const ROUTES: Route[] = [
  { key: 'users-me', path: '/users/me', actor: 'athlete' },
  { key: 'workouts-summary', path: '/workouts?view=summary&limit=20', actor: 'athlete' },
  { key: 'training-programs', path: '/training-programs?limit=20', actor: 'trainer' },
  { key: 'exercises', path: '/exercises?limit=20', actor: 'athlete' },
];

const WARMUPS = 1;
const SAMPLES = 5;
const PASSWORD = 'StrongPassword123!';

/** Counts only Prisma-emitted SQL query events, never captures SQL or parameters. */
class QueryWindow {
  private active = false;
  private observed = 0;

  observe(): void {
    if (this.active) this.observed++;
  }

  begin(): void {
    if (this.active) throw new Error('Concurrent query windows are forbidden');
    this.observed = 0;
    this.active = true;
  }

  end(): number {
    if (!this.active) throw new Error('No active query window');
    this.active = false;
    return this.observed;
  }
}

function percentile(samples: number[], rank: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil((rank / 100) * sorted.length) - 1]!;
}

function sessionCookie(header: string | string[] | undefined): string {
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const cookie = cookies
    .map((value) => value.split(';', 1)[0] ?? '')
    .find((value) => value.startsWith('__Host-sid='));
  if (!cookie) throw new Error('Missing test session cookie');
  return cookie;
}

describe('API Prisma SQL query count baseline (disposable PostgreSQL)', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaClient<'query'> | undefined;
  let athleteId: string | undefined;
  let trainerId: string | undefined;
  let athleteCookie: string;
  let trainerCookie: string;
  const window = new QueryWindow();

  beforeAll(async () => {
    // The guard runs before any Prisma client is constructed or AppModule is loaded.
    useTestDatabase();
    const databaseUrl = process.env.TEST_DATABASE_URL!;
    // Explicitly match the query event log option in the Prisma 7 client type.
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
      log: [{ emit: 'event', level: 'query' }],
    }) as PrismaClient<'query'>;
    // No raw SQL, bind values, stack traces or user records are retained.
    prisma.$on('query', () => window.observe());
    await prisma.$connect();

    const { AppModule } = await import('../../../src/app.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [await ConfigModule.forRoot({ isGlobal: true }), AppModule],
    })
      // Only this test-created Nest application uses the query-event Prisma client.
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();

    const passwordHash = await app.get(PasswordHasher).hash(PASSWORD);
    const fixtureId = randomUUID();
    const athleteEmail = `perf-athlete-${fixtureId}@example.com`;
    const trainerEmail = `perf-trainer-${fixtureId}@example.com`;
    athleteId = (
      await prisma.user.create({
        data: { email: athleteEmail, passwordHash, role: 'ATHLETE' },
        select: { id: true },
      })
    ).id;
    trainerId = (
      await prisma.user.create({
        data: { email: trainerEmail, passwordHash, role: 'TRAINER' },
        select: { id: true },
      })
    ).id;

    async function login(email: string): Promise<string> {
      const response = await request(app!.getHttpServer())
        .post('/auth/login')
        .send({ email, password: PASSWORD });
      expect(response.status).toBe(200);
      return sessionCookie(response.headers['set-cookie']);
    }

    athleteCookie = await login(athleteEmail);
    trainerCookie = await login(trainerEmail);
  }, 60_000);

  afterAll(async () => {
    try {
      if (prisma && athleteId && trainerId) {
        await prisma.user.deleteMany({ where: { id: { in: [athleteId, trainerId] } } });
      }
    } finally {
      await app?.close();
      await prisma?.$disconnect();
    }
  }, 30_000);

  it('counts only within an active measurement window', () => {
    window.observe();
    window.begin();
    window.observe();
    window.observe();
    expect(window.end()).toBe(2);
    window.observe();
    window.begin();
    expect(window.end()).toBe(0);
    expect(() => window.end()).toThrow('No active query window');
  });

  it('records repeatable counts for critical read routes without capturing SQL', async () => {
    const results: Array<{
      route: string;
      samples: number;
      queryCount: { min: number; p50: number; p95: number; max: number };
    }> = [];

    for (const route of ROUTES) {
      const counts: number[] = [];
      const cookie = route.actor === 'athlete' ? athleteCookie : trainerCookie;

      for (let attempt = 0; attempt < WARMUPS + SAMPLES; attempt++) {
        window.begin();
        let count: number;
        try {
          const response = await request(app!.getHttpServer())
            .get(route.path)
            .set('Cookie', cookie);
          expect(response.status).toBe(200);
        } finally {
          count = window.end();
        }
        if (attempt >= WARMUPS) counts.push(count);
      }

      expect(counts).toHaveLength(SAMPLES);
      expect(counts.every((count) => Number.isInteger(count) && count > 0)).toBe(true);
      results.push({
        route: route.key,
        samples: SAMPLES,
        queryCount: {
          min: Math.min(...counts),
          p50: percentile(counts, 50),
          p95: percentile(counts, 95),
          max: Math.max(...counts),
        },
      });
    }

    expect(results.map((item) => item.route)).toEqual(ROUTES.map((item) => item.key));
    // Explicit opt-in: CI assertions run without printing metrics by default.
    if (process.env.API_PERF_SQL_REPORT === '1') {
      console.info(
        'API_PERF_SQL_REPORT ' +
          JSON.stringify({
            schemaVersion: 1,
            method: 'test-scoped Prisma query events; serial HTTP requests',
            warmups: WARMUPS,
            results,
          }),
      );
    }
  }, 60_000);
});
