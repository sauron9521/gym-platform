import { describe, expect, it } from 'vitest';

import { sanitizeExplain, summarizeExplainDiagnostics } from '../../utility/safe-explain-plan.js';

describe('Allowlisted PostgreSQL EXPLAIN metadata', () => {
  it('retains numeric estimates, node shape and vetted relation/index labels only', () => {
    const secret = 'private@identity.example';
    const summary = sanitizeExplain([
      {
        'QUERY PLAN': [
          {
            'Planning Time': 0.2,
            'Execution Time': 1.5,
            Plan: {
              'Node Type': 'Index Scan',
              'Relation Name': 'exercises',
              'Index Name': 'exercises_source_is_archived_idx',
              'Plan Rows': 20,
              'Actual Rows': 20,
              'Actual Loops': 1,
              'Actual Total Time': 0.9,
              'Shared Hit Blocks': 8,
              'Shared Read Blocks': 2,
              'Index Cond': `created_by_id = '${secret}'`,
              Filter: secret,
              Plans: [
                {
                  'Node Type': 'Seq Scan',
                  'Relation Name': 'exercise_muscle_groups',
                  'Plan Rows': 50,
                  'Actual Rows': 32,
                  'Shared Hit Blocks': 5,
                  SQL: 'sensitive raw SELECT',
                },
              ],
            },
          },
        ],
      },
    ]);
    expect(summary).toMatchObject({
      planningMs: 0.2,
      executionMs: 1.5,
      root: {
        nodeType: 'Index Scan',
        relation: 'exercises',
        index: 'exercises_source_is_archived_idx',
        planRows: 20,
        actualRows: 20,
        sharedHitBlocks: 8,
        sharedReadBlocks: 2,
        children: [{ nodeType: 'Seq Scan', relation: 'exercise_muscle_groups' }],
      },
    });
    const output = JSON.stringify(summary);
    expect(output).not.toContain(secret);
    expect(output).not.toContain('Index Cond');
    expect(output).not.toContain('Filter');
    expect(output).not.toContain('sensitive raw');
  });

  it('rejects malformed and missing EXPLAIN plans', () => {
    expect(() => sanitizeExplain([])).toThrow('Expected PostgreSQL JSON EXPLAIN plan');
    expect(() =>
      sanitizeExplain([{ 'QUERY PLAN': JSON.stringify([{ 'Planning Time': 1 }]) }]),
    ).toThrow('Missing root SQL plan');
    expect(() =>
      sanitizeExplain([
        {
          'QUERY PLAN': [{ Plan: { 'Node Type': 'Nested Loop', Plans: [null] } }],
        },
      ]),
    ).toThrow('Unexpected SQL plan child');
  });

  it('pinpoints repeat index lookups, hot scan buffers and underestimated joins', () => {
    const secret = 'private-account@example.com';
    const summary = sanitizeExplain([
      {
        'QUERY PLAN': [
          {
            Plan: {
              'Node Type': 'Nested Loop',
              'Plan Rows': 4,
              'Actual Rows': 1024,
              'Actual Loops': 1,
              'Shared Hit Blocks': 3106,
              Filter: secret,
              Plans: [
                {
                  'Node Type': 'Bitmap Heap Scan',
                  'Relation Name': 'exercise_equipments',
                  'Plan Rows': 4,
                  'Actual Rows': 1024,
                  'Actual Loops': 1,
                  'Shared Hit Blocks': 32,
                  Plans: [
                    {
                      'Node Type': 'Bitmap Index Scan',
                      'Index Name': 'exercise_equipments_equipment_id_exercise_id_idx',
                      'Plan Rows': 4,
                      'Actual Rows': 1024,
                      'Actual Loops': 1,
                      'Shared Hit Blocks': 17,
                    },
                  ],
                },
                {
                  'Node Type': 'Index Scan',
                  'Relation Name': 'exercises',
                  'Index Name': 'exercises_pkey',
                  'Plan Rows': 1,
                  'Actual Rows': 1,
                  'Actual Loops': 1024,
                  'Shared Hit Blocks': 3072,
                  'Index Cond': secret,
                },
              ],
            },
          },
        ],
      },
    ]);
    const diag = summarizeExplainDiagnostics(summary);
    expect(diag.nodeCount).toBe(4);
    expect(diag.scanNodeCount).toBe(3);
    expect(diag.repeatedIndexScans).toMatchObject([
      { index: 'exercises_pkey', loops: 1024, actualRows: 1, depth: 1 },
    ]);
    expect(diag.highBufferScans.slice(0, 2)).toMatchObject([
      { index: 'exercises_pkey', sharedHitBlocks: 3072 },
      { relation: 'exercise_equipments', sharedHitBlocks: 32 },
    ]);
    expect(diag.rowEstimateOutliers[0]).toMatchObject({
      nodeType: 'Nested Loop',
      planRows: 4,
      actualRows: 1024,
      estimateFactor: 256,
    });
    expect(JSON.stringify(diag)).not.toContain(secret);
    // Buffer totals on parent nodes include child activity: NEVER sum 3106 + 3072.
    expect(diag).not.toHaveProperty('totalBufferBlocks');
  });

  it('excludes zeros from ratio claims and redacts unexpected PostgreSQL node labels', () => {
    const summary = sanitizeExplain([
      {
        'QUERY PLAN': [
          {
            Plan: {
              'Node Type': 'private-account@example.com',
              'Plan Rows': 10,
              'Actual Rows': 0,
              'Actual Loops': 1,
              'Shared Hit Blocks': 0,
              Plans: [
                {
                  'Node Type': 'Seq Scan',
                  'Plan Rows': 0,
                  'Actual Rows': 8,
                  'Actual Loops': 1,
                },
              ],
            },
          },
        ],
      },
    ]);
    expect(summary.root.nodeType).toBe('Unknown');
    const diag = summarizeExplainDiagnostics(summary);
    expect(diag.nodeCount).toBe(2);
    expect(diag.scanNodeCount).toBe(1);
    expect(diag.highBufferScans).toEqual([]);
    expect(diag.repeatedIndexScans).toEqual([]);
    expect(diag.rowEstimateOutliers).toEqual([]);
    expect(JSON.stringify(diag)).not.toContain('private-account@example.com');
  });

  it('ignores non-finite and negative metrics and invalid object labels', () => {
    const summary = sanitizeExplain([
      {
        'QUERY PLAN': [
          {
            Plan: {
              'Node Type': 'Aggregate',
              'Relation Name': 'account-email@example.com',
              'Index Name': 'bad index identifier',
              'Actual Rows': -5,
              'Plan Rows': Number.NaN,
              'Shared Read Blocks': 0,
            },
          },
        ],
      },
    ]);
    expect(summary.root).toEqual({
      nodeType: 'Aggregate',
      sharedReadBlocks: 0,
    });
  });
});
