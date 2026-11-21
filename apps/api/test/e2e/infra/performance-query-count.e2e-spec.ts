import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

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

const WARMUPS = 2;
const SAMPLES = 25;
const POPULATION = 128;
const BASE_DATE = Date.UTC(2026, 0, 1);
const FIXTURE_VERSION = 'http-reads-populated-v1-128';
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
  const workoutIds: string[] = [];
  const programIds: string[] = [];
  const exerciseIds: string[] = [];
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

    // Deterministic synthetic shape, generated IDs to avoid collisions with parallel runs.
    // Ownership-scoped cleanup below removes even partially created fixture rows.
    const workouts = Array.from({ length: POPULATION }, (_, index) => ({
      id: randomUUID(),
      title: `Perf workout ${String(index + 1).padStart(3, '0')}`,
      athleteId: athleteId!,
      createdById: athleteId!,
      status: 'PLANNED' as const,
      createdAt: new Date(BASE_DATE + index * 60_000),
      updatedAt: new Date(BASE_DATE + index * 60_000),
    }));
    const programs = Array.from({ length: POPULATION }, (_, index) => ({
      id: randomUUID(),
      trainerId: trainerId!,
      status: 'DRAFT' as const,
      createdAt: new Date(BASE_DATE + index * 60_000),
      updatedAt: new Date(BASE_DATE + index * 60_000),
    }));
    const exercises = Array.from({ length: POPULATION }, (_, index) => ({
      id: randomUUID(),
      name: `Perf exercise ${String(index + 1).padStart(3, '0')}`,
      source: 'GLOBAL' as const,
      exerciseType: 'STRENGTH' as const,
      isArchived: false,
      createdAt: new Date(BASE_DATE + index * 60_000),
      updatedAt: new Date(BASE_DATE + index * 60_000),
    }));
    workoutIds.push(...workouts.map(({ id }) => id));
    programIds.push(...programs.map(({ id }) => id));
    exerciseIds.push(...exercises.map(({ id }) => id));
    await prisma.workout.createMany({ data: workouts });
    await prisma.trainingProgram.createMany({ data: programs });
    await prisma.trainingProgramVersion.createMany({
      data: programs.map(({ id, createdAt, updatedAt }, index) => ({
        id: randomUUID(),
        programId: id,
        version: 1,
        title: `Perf program ${String(index + 1).padStart(3, '0')}`,
        status: 'DRAFT' as const,
        createdAt,
        updatedAt,
      })),
    });
    await prisma.exercise.createMany({ data: exercises });

    expect(await prisma.workout.count({ where: { id: { in: workoutIds } } })).toBe(POPULATION);
    expect(await prisma.trainingProgram.count({ where: { id: { in: programIds } } })).toBe(
      POPULATION,
    );
    expect(await prisma.exercise.count({ where: { id: { in: exerciseIds } } })).toBe(POPULATION);

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
      if (prisma) {
        // Only rows owned by this fixture. Never truncate or delete unrelated DB data.
        if (workoutIds.length) {
          await prisma.workout.deleteMany({ where: { id: { in: workoutIds } } });
        }
        if (programIds.length) {
          await prisma.trainingProgramVersion.deleteMany({
            where: { programId: { in: programIds } },
          });
          await prisma.trainingProgram.deleteMany({ where: { id: { in: programIds } } });
        }
        if (exerciseIds.length) {
          await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
        }
        const userIds = [athleteId, trainerId].filter((id): id is string => Boolean(id));
        if (userIds.length) {
          await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
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

  it('profiles populated authenticated reads with matching HTTP and SQL windows', async () => {
    const sqlResults: Array<{
      route: string;
      samples: number;
      queryCount: { min: number; p50: number; p95: number; max: number };
    }> = [];
    const httpResults: Array<{
      route: string;
      method: 'GET';
      path: string;
      samples: number;
      latencyMs: { min: number; p50: number; p95: number; max: number };
      decodedResponseBytes: { min: number; p50: number; p95: number; max: number };
    }> = [];

    const summarize = (values: number[]) => {
      expect(values).toHaveLength(SAMPLES);
      const sorted = [...values].sort((a, b) => a - b);
      return {
        min: sorted[0]!,
        p50: sorted[Math.ceil(sorted.length / 2) - 1]!,
        p95: sorted[Math.ceil(sorted.length * 0.95) - 1]!,
        max: sorted.at(-1)!,
      };
    };

    for (const route of ROUTES) {
      const counts: number[] = [];
      const latencies: number[] = [];
      const byteSizes: number[] = [];
      const cookie = route.actor === 'athlete' ? athleteCookie : trainerCookie;

      for (let attempt = 0; attempt < WARMUPS + SAMPLES; attempt++) {
        window.begin();
        const start = performance.now();
        let count: number;
        let elapsedMs: number;
        let decodedBytes: number;
        try {
          const response = await request(app!.getHttpServer())
            .get(route.path)
            .set('Cookie', cookie);

          elapsedMs = Number((performance.now() - start).toFixed(3));
          expect(response.status).toBe(200);
          if (route.key === 'users-me') {
            expect(response.body.id).toBe(athleteId);
          } else {
            // Verify that a successful response actually contains a full page.
            expect(response.body.data).toHaveLength(20);
          }
          // Nest's default compact JSON serialization; this is NOT compressed wire size.
          decodedBytes = Buffer.byteLength(JSON.stringify(response.body), 'utf8');
          expect(decodedBytes).toBeGreaterThan(0);
        } finally {
          count = window.end();
        }

        if (attempt >= WARMUPS) {
          counts.push(count);
          latencies.push(elapsedMs);
          byteSizes.push(decodedBytes);
        }
      }

      expect(counts.every((count) => Number.isInteger(count) && count > 0)).toBe(true);
      sqlResults.push({
        route: route.key,
        samples: SAMPLES,
        queryCount: summarize(counts),
      });
      httpResults.push({
        route: route.key,
        method: 'GET',
        path: route.path,
        samples: SAMPLES,
        latencyMs: summarize(latencies),
        decodedResponseBytes: summarize(byteSizes),
      });
    }

    expect(sqlResults.map(({ route }) => route)).toEqual(ROUTES.map(({ key }) => key));
    expect(httpResults.map(({ route }) => route)).toEqual(ROUTES.map(({ key }) => key));

    const sqlReport = {
      schemaVersion: 1,
      method: 'test-scoped Prisma query events; serial HTTP requests',
      warmups: WARMUPS,
      results: sqlResults,
    };
    const httpReport = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      nodeVersion: process.version,
      methodology: {
        concurrency: 1,
        warmupPerRoute: WARMUPS,
        samplesPerRoute: SAMPLES,
        pauseMs: 0,
        latency: 'elapsed time through complete response body read',
        bytes: 'decoded response body size, not network transfer bytes',
      },
      results: httpResults,
    };

    // Report only allowlisted route identifiers, numeric metrics and fixture recipe.
    // Never log SQL statements, SQL parameters, cookies, tokens or response bodies.
    if (process.env.API_PERF_SQL_REPORT === '1') {
      console.info('API_PERF_SQL_REPORT ' + JSON.stringify(sqlReport));
    }
    if (process.env.API_PERF_PROFILE_REPORT === '1') {
      console.info(
        'API_PERF_PROFILE ' +
          JSON.stringify({
            schemaVersion: 1,
            fixture: {
              recipe: FIXTURE_VERSION,
              athleteAccounts: 1,
              trainerAccounts: 1,
              workouts: POPULATION,
              trainingPrograms: POPULATION,
              trainingProgramVersions: POPULATION,
              exercises: POPULATION,
            },
            http: httpReport,
            sql: sqlReport,
          }),
      );
    }
  }, 90_000);
});
