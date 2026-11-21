import { describe, expect, it } from 'vitest';

import { SafePrismaQueryWindow } from '../../utility/safe-prisma-query-profile.js';

describe('Privacy-safe Prisma SQL profile window', () => {
  const query =
    'SELECT "exercises"."id" FROM "public"."exercises" ' +
    'WHERE "exercises"."created_by_id" = $1 ' +
    'AND "exercises"."name" ILIKE $2 ' +
    'AND EXISTS (SELECT 1 FROM "public"."exercise_muscle_groups" ' +
    'JOIN "public"."muscle_groups" ON TRUE)';

  it('emits stable template fingerprints and only allowlisted table names', () => {
    const profile = new SafePrismaQueryWindow();
    profile.begin('muscle-page');
    profile.observe({ query, duration: 1.75 });
    profile.observe({ query, duration: 2.25 });
    const result = profile.end('muscle-page');

    expect(result.queryCount).toBe(2);
    expect(result.sql[0]).toMatchObject({
      statement: 'SELECT',
      bindPlaceholders: 2,
      durationMs: 1.75,
      tables: ['exercises', 'exercise_muscle_groups', 'muscle_groups'],
    });
    expect(result.sql[0].sqlFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.sql[0].sqlFingerprint).toBe(result.sql[1].sqlFingerprint);
    expect(result.sql[0].sqlTemplateBytes).toBe(Buffer.byteLength(query));
    const json = JSON.stringify(result);
    expect(json).not.toContain('SELECT "exercises"');
    expect(json).not.toContain('created_by_id');
    expect(json).not.toContain('ILIKE');
    expect(json).not.toContain('$1');
  });

  it('never accesses parameters or SQL text embedded with a synthetic secret in output', () => {
    const profile = new SafePrismaQueryWindow();
    const secret = 'private-athlete-email@example.test';
    profile.begin('search-page');
    const unsafe = {
      query: `WITH d AS (SELECT '${secret}' AS private_data) SELECT * FROM d`,
      duration: 0.15,
      get params(): never {
        throw new Error('The query profiler must never read Prisma bind params');
      },
    };
    profile.observe(unsafe);
    const result = profile.end('search-page');
    expect(result.sql[0]).toMatchObject({
      statement: 'WITH',
      tables: [],
      bindPlaceholders: 0,
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain('private_data');
    expect(JSON.stringify(result)).not.toContain('WITH d AS');
  });

  it('does not include transaction or mutating query events in query counts', () => {
    const profile = new SafePrismaQueryWindow();
    profile.begin('global-count');
    profile.observe({ query: 'BEGIN', duration: 0.1 });
    profile.observe({ query: 'INSERT INTO "exercises" VALUES ($1)', duration: 0.5 });
    profile.observe({ query: 'COMMIT', duration: 0.1 });
    profile.observe({ query: 'SELECT COUNT(*) FROM "public"."exercises"', duration: 0.8 });
    expect(profile.end('global-count')).toMatchObject({
      scenario: 'global-count',
      queryCount: 1,
      sql: [{ tables: ['exercises'], statement: 'SELECT' }],
    });
  });

  it('rejects invalid scenario labels, nested windows, missing events and mismatched ends', () => {
    const profile = new SafePrismaQueryWindow();
    expect(() => profile.begin('secret@example.test')).toThrow('Invalid profile scenario label');
    profile.begin('global-page');
    expect(() => profile.begin('search-page')).toThrow('Concurrent Prisma');
    expect(() => profile.end('search-page')).toThrow('Mismatched Prisma');
    expect(() => profile.end('global-page')).toThrow('No Prisma SELECT');
    expect(() => profile.end('global-page')).toThrow('Mismatched Prisma');
    profile.begin('equipment-page');
    profile.observe({ query, duration: 1 });
    profile.reset();
    expect(() => profile.end('equipment-page')).toThrow('Mismatched Prisma');
  });

  it('rejects malformed timings when observing a read query', () => {
    const profile = new SafePrismaQueryWindow();
    profile.begin('search-count');
    expect(() => profile.observe({ query, duration: Number.NaN })).toThrow('Invalid Prisma');
    expect(() => profile.observe({ query, duration: -5 })).toThrow('Invalid Prisma');
    profile.reset();
  });
});
