import { describe, expect, it } from 'vitest';

import { sanitizeExplain } from '../../utility/safe-explain-plan.js';

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
