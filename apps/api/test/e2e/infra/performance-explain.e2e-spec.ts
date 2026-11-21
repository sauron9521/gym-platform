import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '#prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { useTestDatabase } from '../../utility/test-db-helper.js';

const FIXTURE_ROWS = 128;
const BASE_DATE = Date.UTC(2026, 0, 1);
const EXPLAIN_PREFIX = 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ';
const ROLLBACK = Symbol('rollback synthetic fixtures');

const QUERIES = [
  {
    key: 'users-me',
    sql: `${EXPLAIN_PREFIX}SELECT id, email, role FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    actor: 'athlete',
  },
  {
    key: 'workouts-summary',
    sql: `${EXPLAIN_PREFIX}SELECT id, title, status FROM workouts WHERE athlete_id = $1 ORDER BY created_at DESC, id DESC LIMIT 20`,
    actor: 'athlete',
  },
  {
    key: 'training-programs',
    sql: `${EXPLAIN_PREFIX}SELECT id, status FROM training_programs WHERE trainer_id = $1 ORDER BY updated_at DESC, id DESC LIMIT 20`,
    actor: 'trainer',
  },
  {
    key: 'exercises',
    sql: `${EXPLAIN_PREFIX}SELECT id, name, source FROM exercises WHERE source = 'GLOBAL' AND is_archived = FALSE ORDER BY name ASC, id ASC LIMIT 20`,
    actor: null,
  },
] as const;

type PlanNode = Record<string, unknown>;
type RawPlan = {
  Plan: PlanNode;
  'Planning Time'?: number;
  'Execution Time'?: number;
};
type ExplainRow = { 'QUERY PLAN': RawPlan[] | string };
type SanitizedNode = {
  nodeType: string;
  relation?: string;
  index?: string;
  planRows?: number;
  actualRows?: number;
  loops?: number;
  actualTotalTimeMs?: number;
  sharedHitBlocks?: number;
  sharedReadBlocks?: number;
  children?: SanitizedNode[];
};

function sanitizedNode(node: PlanNode): SanitizedNode {
  const result: SanitizedNode = {
    nodeType: typeof node['Node Type'] === 'string' ? node['Node Type'] : 'Unknown',
  };
  const textFields = [
    ['Relation Name', 'relation'],
    ['Index Name', 'index'],
  ] as const;
  for (const [source, target] of textFields) {
    const value = node[source];
    if (typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
      result[target] = value;
    }
  }
  const metrics = [
    ['Plan Rows', 'planRows'],
    ['Actual Rows', 'actualRows'],
    ['Actual Loops', 'loops'],
    ['Actual Total Time', 'actualTotalTimeMs'],
    ['Shared Hit Blocks', 'sharedHitBlocks'],
    ['Shared Read Blocks', 'sharedReadBlocks'],
  ] as const;
  for (const [source, target] of metrics) {
    const value = node[source];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      result[target] = value;
    }
  }
  if (Array.isArray(node.Plans)) {
    result.children = node.Plans.map((child: unknown) => {
      if (!child || typeof child !== 'object') throw new Error('Unexpected SQL plan child');
      return sanitizedNode(child as PlanNode);
    });
  }
  return result;
}

function sanitizeExplain(rows: ExplainRow[]) {
  const first = rows[0]?.['QUERY PLAN'];
  const payload: unknown = typeof first === 'string' ? JSON.parse(first) : first;
  if (!Array.isArray(payload) || !payload[0] || typeof payload[0] !== 'object') {
    throw new Error('Expected PostgreSQL JSON EXPLAIN plan');
  }
  const plan = payload[0] as RawPlan;
  if (!plan.Plan || typeof plan.Plan !== 'object') {
    throw new Error('Missing root SQL plan');
  }
  return {
    planningMs: plan['Planning Time'],
    executionMs: plan['Execution Time'],
    root: sanitizedNode(plan.Plan),
  };
}

describe('API SQL execution plans (throwaway PostgreSQL fixtures)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Never connect to a dev or production DB, even for read-only EXPLAIN.
    useTestDatabase();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }),
    });
    await prisma.$connect();
  }, 20_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('omits SQL text, conditions, and even nested sensitive plan fields', () => {
    const marker = 'private-identity@example.com';
    const report = sanitizeExplain([
      {
        'QUERY PLAN': [
          {
            'Planning Time': 1,
            'Execution Time': 2,
            Plan: {
              'Node Type': 'Index Scan',
              'Relation Name': 'users',
              'Index Name': 'users_pkey',
              'Index Cond': `id = '${marker}'`,
              'Actual Rows': 1,
              Plans: [
                {
                  'Node Type': 'Seq Scan',
                  Filter: marker,
                  'Actual Total Time': 0.5,
                },
              ],
            },
          },
        ],
      },
    ]);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(marker);
    expect(serialized).not.toContain('Filter');
    expect(serialized).not.toContain('Index Cond');
    expect(report.root.children?.[0]?.nodeType).toBe('Seq Scan');
    expect(report.root.index).toBe('users_pkey');
  });

  it('captures four read-only JSON plans with fixed-size synthetic populations, then rolls them back', async () => {
    const fixtureId = randomUUID();
    const athleteId = randomUUID();
    const trainerId = randomUUID();
    const fixtureExercisePrefix = `SQL-${fixtureId.slice(0, 8)}-exercise-`;
    const observations: Array<{
      route: string;
      rows: number;
      plan: ReturnType<typeof sanitizeExplain>;
    }> = [];

    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL statement_timeout = '10s'`;

          await tx.user.createMany({
            data: [
              {
                id: athleteId,
                email: `explain-athlete-${fixtureId}@example.com`,
                passwordHash: 'synthetic-never-for-authentication',
                role: 'ATHLETE',
              },
              {
                id: trainerId,
                email: `explain-trainer-${fixtureId}@example.com`,
                passwordHash: 'synthetic-never-for-authentication',
                role: 'TRAINER',
              },
            ],
          });

          await tx.workout.createMany({
            data: Array.from({ length: FIXTURE_ROWS }, (_, index) => ({
              title: `SQL fixture workout ${index + 1}`,
              athleteId,
              createdById: athleteId,
              status: 'PLANNED' as const,
              createdAt: new Date(BASE_DATE + index * 60_000),
            })),
          });
          await tx.trainingProgram.createMany({
            data: Array.from({ length: FIXTURE_ROWS }, (_, index) => ({
              trainerId,
              status: 'DRAFT' as const,
              createdAt: new Date(BASE_DATE + index * 60_000),
            })),
          });
          await tx.exercise.createMany({
            data: Array.from({ length: FIXTURE_ROWS }, (_, index) => ({
              name: `${fixtureExercisePrefix}${String(index + 1).padStart(3, '0')}`,
              source: 'GLOBAL' as const,
              exerciseType: 'STRENGTH' as const,
            })),
          });

          expect(await tx.workout.count({ where: { athleteId } })).toBe(FIXTURE_ROWS);
          expect(await tx.trainingProgram.count({ where: { trainerId } })).toBe(FIXTURE_ROWS);
          expect(
            await tx.exercise.count({ where: { name: { startsWith: fixtureExercisePrefix } } }),
          ).toBe(FIXTURE_ROWS);

          for (const item of QUERIES) {
            const args =
              item.actor === 'athlete' ? [athleteId] : item.actor === 'trainer' ? [trainerId] : [];
            // Fixed, reviewed SELECT templates only. No dynamic SQL or user-provided statements.
            const raw = await tx.$queryRawUnsafe<ExplainRow[]>(item.sql, ...args);
            const plan = sanitizeExplain(raw);
            expect(plan.root.nodeType).toBeTruthy();
            expect(plan.root.actualRows).toBeGreaterThan(0);
            expect(plan.executionMs).toBeGreaterThanOrEqual(0);
            observations.push({ route: item.key, rows: FIXTURE_ROWS, plan });
          }

          // Force rollback for **all** fixtures, including on successful assertions.
          throw ROLLBACK;
        },
        { timeout: 45_000, maxWait: 10_000 },
      );
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }

    expect(observations.map((item) => item.route)).toEqual(QUERIES.map((item) => item.key));
    expect(await prisma.workout.count({ where: { athleteId } })).toBe(0);
    expect(await prisma.trainingProgram.count({ where: { trainerId } })).toBe(0);
    expect(
      await prisma.exercise.count({ where: { name: { startsWith: fixtureExercisePrefix } } }),
    ).toBe(0);
    expect(await prisma.user.count({ where: { id: { in: [athleteId, trainerId] } } })).toBe(0);

    if (process.env.API_PERF_EXPLAIN_REPORT === '1') {
      console.info(
        'API_PERF_EXPLAIN ' +
          JSON.stringify({
            schemaVersion: 1,
            fixtureRowsPerTable: FIXTURE_ROWS,
            postgres: 'JSON EXPLAIN ANALYZE BUFFERS; SELECT statements only',
            plans: observations,
          }),
      );
    }
  }, 65_000);
});
