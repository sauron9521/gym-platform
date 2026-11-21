import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '#prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  sanitizeExplain,
  summarizeExplainDiagnostics,
  type ExplainRow,
} from '../../utility/safe-explain-plan.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

const ACTIVE_GLOBAL = 2_048;
const ARCHIVED_GLOBAL = 256;
const PRIVATE_ATHLETE = 512;
const PAGE_SIZE = 20;
const ROLLBACK = Symbol('rollback exercise SQL plan fixtures');
const EXPLAIN = 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ';

// Representative SQL shapes for ExercisesRepository.list + count and its
// optional name, muscle and equipment filters. These are reviewed read-only
// SELECT templates, NOT captured Prisma SQL or all HTTP authorization joins.
const SCENARIOS = [
  {
    key: 'global-page',
    sql: `${EXPLAIN}SELECT e.id, e.name, e.source FROM exercises e
      WHERE e.source = 'GLOBAL' AND e.is_archived = FALSE
      ORDER BY e.name ASC, e.id ASC LIMIT $1 OFFSET $2`,
    args: () => [PAGE_SIZE, 200],
  },
  {
    key: 'global-count',
    sql: `${EXPLAIN}SELECT COUNT(*) FROM exercises e
      WHERE e.source = 'GLOBAL' AND e.is_archived = FALSE`,
    args: () => [],
  },
  {
    key: 'search-page',
    sql: `${EXPLAIN}SELECT e.id, e.name, e.source FROM exercises e
      WHERE e.source = 'GLOBAL' AND e.is_archived = FALSE AND e.name ILIKE $1
      ORDER BY e.name ASC, e.id ASC LIMIT $2 OFFSET $3`,
    args: () => ['%bench%', PAGE_SIZE, 0],
  },
  {
    key: 'search-count',
    sql: `${EXPLAIN}SELECT COUNT(*) FROM exercises e
      WHERE e.source = 'GLOBAL' AND e.is_archived = FALSE AND e.name ILIKE $1`,
    args: () => ['%bench%'],
  },
  {
    key: 'muscle-page',
    sql: `${EXPLAIN}SELECT e.id, e.name, e.source FROM exercises e
      WHERE e.source = 'GLOBAL' AND e.is_archived = FALSE
        AND EXISTS (SELECT 1 FROM exercise_muscle_groups mg
          JOIN muscle_groups m ON mg.muscle_group_id = m.id
          WHERE mg.exercise_id = e.id AND m.slug = $1)
      ORDER BY e.name ASC, e.id ASC LIMIT $2 OFFSET $3`,
    args: (context: QueryContext) => [context.muscleSlug, PAGE_SIZE, 0],
  },
  {
    key: 'muscle-count',
    sql: `${EXPLAIN}SELECT COUNT(*) FROM exercises e
      WHERE e.source = 'GLOBAL' AND e.is_archived = FALSE
        AND EXISTS (SELECT 1 FROM exercise_muscle_groups mg
          JOIN muscle_groups m ON mg.muscle_group_id = m.id
          WHERE mg.exercise_id = e.id AND m.slug = $1)`,
    args: (context: QueryContext) => [context.muscleSlug],
  },
  {
    key: 'equipment-page',
    sql: `${EXPLAIN}SELECT e.id, e.name, e.source FROM exercises e
      WHERE e.source = 'GLOBAL' AND e.is_archived = FALSE
        AND EXISTS (SELECT 1 FROM exercise_equipments ee
          JOIN equipment eq ON ee.equipment_id = eq.id
          WHERE ee.exercise_id = e.id AND eq.slug = $1)
      ORDER BY e.name ASC, e.id ASC LIMIT $2 OFFSET $3`,
    args: (context: QueryContext) => [context.equipmentSlug, PAGE_SIZE, 0],
  },
  {
    key: 'athlete-visible-page',
    sql: `${EXPLAIN}SELECT e.id, e.name, e.source FROM exercises e
      WHERE e.is_archived = FALSE
        AND (e.source = 'GLOBAL'
          OR (e.source = 'ATHLETE_CUSTOM' AND e.created_by_id = $1))
      ORDER BY e.name ASC, e.id ASC LIMIT $2 OFFSET $3`,
    args: (context: QueryContext) => [context.athleteId, PAGE_SIZE, 0],
  },
] as const;

type QueryContext = { athleteId: string; muscleSlug: string; equipmentSlug: string };

describe('Exercises multi-thousand-row SQL plans (rollback-only PostgreSQL)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Hard fail before opening any database connection unless this is a *_test DB.
    useTestDatabase();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }),
    });
    await prisma.$connect();
  }, 20_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('examines public list/count, ILIKE, nested filters and athlete visibility, then rolls back all data', async () => {
    const fixtureId = randomUUID();
    const athleteId = randomUUID();
    const suffix = fixtureId.slice(0, 8);
    const exerciseIds: string[] = [];
    const observations: Array<{
      scenario: string;
      plan: ReturnType<typeof sanitizeExplain>;
      diagnostics: ReturnType<typeof summarizeExplainDiagnostics>;
    }> = [];

    const rows: Prisma.ExerciseCreateManyInput[] = [
      ...Array.from({ length: ACTIVE_GLOBAL }, (_, index) => ({
        id: randomUUID(),
        name: `${index % 4 === 0 ? 'Bench Press' : 'Squat Row'} plan ${suffix} ${String(index).padStart(4, '0')}`,
        source: 'GLOBAL' as const,
        exerciseType: 'STRENGTH' as const,
        isArchived: false,
      })),
      ...Array.from({ length: ARCHIVED_GLOBAL }, (_, index) => ({
        id: randomUUID(),
        name: `Bench archived plan ${suffix} ${String(index).padStart(4, '0')}`,
        source: 'GLOBAL' as const,
        exerciseType: 'STRENGTH' as const,
        isArchived: true,
      })),
      ...Array.from({ length: PRIVATE_ATHLETE }, (_, index) => ({
        id: randomUUID(),
        name: `Bench private plan ${suffix} ${String(index).padStart(4, '0')}`,
        source: 'ATHLETE_CUSTOM' as const,
        exerciseType: 'STRENGTH' as const,
        visibility: 'PRIVATE' as const,
        createdById: athleteId,
        isArchived: false,
      })),
    ];
    exerciseIds.push(...rows.map(({ id }) => id!));

    try {
      await prisma.$transaction(
        async (tx) => {
          // Read-only EXPLAIN ANALYZE queries run after these synthetic inserts.
          // No database-wide ANALYZE or statistics modifications on a shared DB.
          await tx.$executeRaw`SET LOCAL statement_timeout = '15s'`;
          await tx.user.create({
            data: {
              id: athleteId,
              email: `exercise-plan-${fixtureId}@example.test`,
              passwordHash: 'not-usable-for-login',
              role: 'ATHLETE',
            },
          });
          const chest = await tx.muscleGroup.create({
            data: { name: `Plan muscle ${suffix} A`, slug: `plan-muscle-${suffix}-a` },
          });
          const back = await tx.muscleGroup.create({
            data: { name: `Plan muscle ${suffix} B`, slug: `plan-muscle-${suffix}-b` },
          });
          const barbell = await tx.equipment.create({
            data: { name: `Plan equipment ${suffix}`, slug: `plan-equipment-${suffix}` },
          });
          await tx.exercise.createMany({ data: rows });
          const globalIds = rows.slice(0, ACTIVE_GLOBAL).map(({ id }) => id!);
          await tx.exerciseMuscleGroup.createMany({
            data: globalIds.map((id, index) => ({
              exerciseId: id,
              muscleGroupId: index % 3 === 0 ? chest.id : back.id,
              role: 'PRIMARY' as const,
            })),
          });
          await tx.exerciseEquipment.createMany({
            data: globalIds
              .filter((_, index) => index % 2 === 0)
              .map((id) => ({
                exerciseId: id,
                equipmentId: barbell.id,
              })),
          });

          // Assert the fixture's own distribution and link selectivity.
          expect(
            await tx.exercise.count({ where: { id: { in: globalIds }, isArchived: false } }),
          ).toBe(ACTIVE_GLOBAL);
          expect(
            await tx.exercise.count({
              where: { id: { in: exerciseIds }, source: 'GLOBAL', isArchived: true },
            }),
          ).toBe(ARCHIVED_GLOBAL);
          expect(
            await tx.exercise.count({
              where: { createdById: athleteId, visibility: 'PRIVATE' },
            }),
          ).toBe(PRIVATE_ATHLETE);
          expect(
            await tx.exercise.count({
              where: { muscleGroups: { some: { muscleGroupId: chest.id } } },
            }),
          ).toBe(Math.ceil(ACTIVE_GLOBAL / 3));
          expect(
            await tx.exercise.count({
              where: { equipment: { some: { equipmentId: barbell.id } } },
            }),
          ).toBe(ACTIVE_GLOBAL / 2);
          expect(
            await tx.exercise.count({
              where: {
                id: { in: globalIds },
                name: { contains: 'bench', mode: 'insensitive' },
              },
            }),
          ).toBe(ACTIVE_GLOBAL / 4);

          const context: QueryContext = {
            athleteId,
            muscleSlug: chest.slug,
            equipmentSlug: barbell.slug,
          };
          for (const scenario of SCENARIOS) {
            // SQL templates are fixed constants, parameters always bound.
            const raw = await tx.$queryRawUnsafe<ExplainRow[]>(
              scenario.sql,
              ...scenario.args(context),
            );
            const plan = sanitizeExplain(raw);
            expect(plan.root.nodeType).toBeTruthy();
            expect(plan.root.actualRows).toBeGreaterThan(0);
            expect(plan.executionMs).toBeGreaterThanOrEqual(0);
            const diagnostics = summarizeExplainDiagnostics(plan);
            expect(diagnostics.nodeCount).toBeGreaterThanOrEqual(1);
            observations.push({ scenario: scenario.key, plan, diagnostics });
          }

          throw ROLLBACK;
        },
        { timeout: 90_000, maxWait: 10_000 },
      );
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }

    expect(observations.map(({ scenario }) => scenario)).toEqual(SCENARIOS.map(({ key }) => key));
    expect(await prisma.exercise.count({ where: { id: { in: exerciseIds } } })).toBe(0);
    expect(await prisma.user.count({ where: { id: athleteId } })).toBe(0);

    if (process.env.API_PERF_EXERCISE_PLANS_REPORT === '1') {
      // Only numeric fixture sizes, scenario keys and vetted EXPLAIN nodes.
      console.info(
        'API_PERF_EXERCISE_PLANS ' +
          JSON.stringify({
            schemaVersion: 1,
            fixture: {
              activeGlobal: ACTIVE_GLOBAL,
              archivedGlobal: ARCHIVED_GLOBAL,
              privateAthlete: PRIVATE_ATHLETE,
              primaryMuscleLinks: ACTIVE_GLOBAL,
              equipmentLinks: ACTIVE_GLOBAL / 2,
              benchNameMatches: ACTIVE_GLOBAL / 4,
              muscleGroupMatches: Math.ceil(ACTIVE_GLOBAL / 3),
              equipmentMatches: ACTIVE_GLOBAL / 2,
            },
            methodology: 'representative fixed SELECT shapes; rollback-only test fixture',
            plans: observations,
          }),
      );
    }
  }, 120_000);
});
