import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '#prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../../src/infra/database/prisma.service.js';
import { ExercisesRepository } from '../../../src/modules/exercises/repositories/exercises.repository.js';
import { SafePrismaQueryWindow } from '../../utility/safe-prisma-query-profile.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

const ACTIVE = 256;
const ARCHIVED = 32;
const TAKE = 20;
const QUERY_TIMEOUT = 120_000;

/**
 * The repository's real array $transaction cannot see uncommitted writes
 * from the separate interactive transaction used in the EXPLAIN probe.
 * This test therefore commits *uniquely owned* fixture rows and deletes
 * only those rows in a finally block, on an enforced *_test database.
 */
describe('ExercisesRepository real pagination transaction SQL profile (test database only)', () => {
  let prisma: PrismaClient<'query'>;
  const window = new SafePrismaQueryWindow();

  beforeAll(async () => {
    useTestDatabase(); // Fail closed BEFORE opening a database connection.
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }),
      log: [{ emit: 'event', level: 'query' }],
    }) as PrismaClient<'query'>;
    prisma.$on('query', (event) => window.observe(event));
    await prisma.$connect();
  }, 20_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it(
    'measures count, nested projections and BEGIN/COMMIT for real repository reads',
    async () => {
      const runId = randomUUID();
      const ownerId = randomUUID();
      const muscleId = randomUUID();
      const equipmentId = randomUUID();
      const namePrefix = 'Repository perf ' + runId.slice(0, 8);
      const muscleSlug = 'repository-muscle-' + runId;
      const equipmentSlug = 'repository-equipment-' + runId;
      const exerciseRows = Array.from({ length: ACTIVE + ARCHIVED }, (_, index) => ({
        id: randomUUID(),
        name:
          namePrefix + (index % 4 === 0 ? ' Bench ' : ' Squat ') + String(index).padStart(4, '0'),
        source: 'ATHLETE_CUSTOM' as const,
        visibility: 'PRIVATE' as const,
        exerciseType: 'STRENGTH' as const,
        createdById: ownerId,
        isArchived: index >= ACTIVE,
      }));
      const exerciseIds = exerciseRows.map(({ id }) => id);
      const activeIds = exerciseIds.slice(0, ACTIVE);
      const repository = new ExercisesRepository(prisma as unknown as PrismaService);

      const reports: Array<{
        scenario: string;
        returned: number;
        total: number;
        skip: number;
        take: number;
        totalPages: number;
        elapsedMs: number;
        profile: ReturnType<SafePrismaQueryWindow['end']>;
      }> = [];

      try {
        await prisma.user.create({
          data: {
            id: ownerId,
            email: 'repository-perf-' + runId + '@example.test',
            passwordHash: 'not-a-login-credential',
            role: 'ATHLETE',
          },
        });
        await prisma.muscleGroup.create({
          data: { id: muscleId, name: 'Repository muscle ' + runId, slug: muscleSlug },
        });
        await prisma.equipment.create({
          data: { id: equipmentId, name: 'Repository equipment ' + runId, slug: equipmentSlug },
        });
        await prisma.exercise.createMany({ data: exerciseRows });
        await prisma.exerciseMuscleGroup.createMany({
          data: activeIds
            .filter((_, index) => index % 2 === 0)
            .map((exerciseId) => ({
              exerciseId,
              muscleGroupId: muscleId,
              role: 'PRIMARY' as const,
            })),
        });
        await prisma.exerciseEquipment.createMany({
          data: activeIds
            .filter((_, index) => index % 2 === 0)
            .map((exerciseId) => ({
              exerciseId,
              equipmentId,
            })),
        });

        // Only this synthetic athlete's own rows are visible in this probe.
        const base: Prisma.ExerciseWhereInput = {
          AND: [
            { createdById: ownerId, source: 'ATHLETE_CUSTOM' },
            { isArchived: false },
            { name: { startsWith: namePrefix } },
          ],
        };
        const scenarios: Array<{
          key: string;
          where: Prisma.ExerciseWhereInput;
          expected: number;
          skip: number;
        }> = [
          { key: 'private-page', where: base, expected: ACTIVE, skip: 40 },
          {
            key: 'private-search-page',
            where: { AND: [base, { name: { contains: 'Bench', mode: 'insensitive' } }] },
            expected: ACTIVE / 4,
            skip: 0,
          },
          {
            key: 'private-muscle-page',
            where: {
              AND: [base, { muscleGroups: { some: { muscleGroup: { slug: muscleSlug } } } }],
            },
            expected: ACTIVE / 2,
            skip: 0,
          },
          {
            key: 'private-equipment-page',
            where: {
              AND: [base, { equipment: { some: { equipment: { slug: equipmentSlug } } } }],
            },
            expected: ACTIVE / 2,
            skip: 0,
          },
        ];

        for (const scenario of scenarios) {
          window.begin(scenario.key, { trackTransaction: true });
          try {
            const start = performance.now();
            const page = await repository.findMany({
              where: scenario.where,
              skip: scenario.skip,
              take: TAKE,
            });
            const elapsedMs = Number((performance.now() - start).toFixed(3));
            // Prisma's query callbacks can be delivered in a later microtask.
            await new Promise<void>((resolve) => setImmediate(resolve));
            const profile = window.end(scenario.key);

            expect(page.data).toHaveLength(TAKE);
            expect(page.meta).toMatchObject({
              skip: scenario.skip,
              take: TAKE,
              total: scenario.expected,
              totalPages: Math.ceil(scenario.expected / TAKE),
            });
            expect(page.data.every((row) => row.createdById === ownerId && !row.isArchived)).toBe(
              true,
            );
            expect(profile.queryCount).toBeGreaterThanOrEqual(2);
            // Prisma 7's query event stream can omit a BEGIN even when the
            // repository executes $transaction; only assert observed COMMIT.
            // Missing BEGIN is never inferred or backfilled.
            expect(profile.transactionControls).toMatchObject({ commit: 1, rollback: 0 });
            expect(profile.transactionControls?.begin).toBeGreaterThanOrEqual(0);
            expect(profile.transactionControls?.begin).toBeLessThanOrEqual(1);
            reports.push({
              scenario: scenario.key,
              returned: page.data.length,
              total: page.meta.total,
              skip: scenario.skip,
              take: TAKE,
              totalPages: page.meta.totalPages,
              elapsedMs,
              profile,
            });
          } finally {
            window.reset();
          }
        }
      } finally {
        window.reset();
        // Scoped clean-up only. No truncate, global delete or database-wide ANALYZE.
        await prisma.$transaction([
          prisma.exercise.deleteMany({ where: { id: { in: exerciseIds }, createdById: ownerId } }),
          prisma.muscleGroup.deleteMany({ where: { id: muscleId } }),
          prisma.equipment.deleteMany({ where: { id: equipmentId } }),
          prisma.user.deleteMany({ where: { id: ownerId } }),
        ]);
      }

      expect(await prisma.exercise.count({ where: { id: { in: exerciseIds } } })).toBe(0);
      expect(await prisma.user.count({ where: { id: ownerId } })).toBe(0);
      expect(reports).toHaveLength(4);

      if (process.env.API_PERF_EXERCISE_PLANS_REPORT === '1') {
        console.info(
          'API_PERF_EXERCISE_REPOSITORY ' +
            JSON.stringify({
              schemaVersion: 1,
              fixture: {
                activePrivate: ACTIVE,
                archivedPrivate: ARCHIVED,
                muscleLinks: ACTIVE / 2,
                equipmentLinks: ACTIVE / 2,
              },
              methodology:
                'actual repository array transaction; unique committed test rows; scoped cleanup',
              reads: reports,
            }),
        );
      }
    },
    QUERY_TIMEOUT,
  );
});
