import { createHash } from 'node:crypto';

type QueryEvent = Readonly<{ query: string; duration: number }>;

const TABLES = [
  'exercises',
  'exercise_muscle_groups',
  'muscle_groups',
  'exercise_equipments',
  'equipment',
] as const;

/** A finite, fixed allowlist prevents query text, bind values or actor IDs leaking. */
function sanitizeQuery(event: QueryEvent) {
  // No SQL query text or event.params is stored. Prisma sends bind values in
  // event.params, which this utility never accepts or accesses.
  if (!/^\s*(?:SELECT|WITH)\b/i.test(event.query)) return null;
  if (!Number.isFinite(event.duration) || event.duration < 0) {
    throw new Error('Invalid Prisma query timing');
  }
  const hash = createHash('sha256').update(event.query, 'utf8').digest('hex');
  const referencedTables = TABLES.filter((table) => {
    const sqlTable = new RegExp(
      `\\b(?:FROM|JOIN)\\s+(?:"public"\\.)?"?${table}"?(?=\\s|\\)|,|$)`,
      'i',
    );
    return sqlTable.test(event.query);
  });
  const parameters = event.query.match(/\$[1-9][0-9]*/g) ?? [];
  return {
    sqlFingerprint: hash,
    statement: /^\s*WITH\b/i.test(event.query) ? 'WITH' : 'SELECT',
    sqlTemplateBytes: Buffer.byteLength(event.query, 'utf8'),
    bindPlaceholders: new Set(parameters).size,
    tables: referencedTables,
    durationMs: event.duration,
  };
}

export type SanitizedPrismaQuery = NonNullable<ReturnType<typeof sanitizeQuery>>;

/**
 * Captures only Prisma-emitted SELECT structure during an explicit await.
 * A read-only diagnostic: no SQL string, params, returned records, raw
 * errors, identifiers or personally identifying values leave this scope.
 */
export class SafePrismaQueryWindow {
  private active: {
    scenario: string;
    samples: SanitizedPrismaQuery[];
    trackTransaction: boolean;
    transactionControls: { begin: number; commit: number; rollback: number };
  } | null = null;

  begin(scenario: string, options: { trackTransaction?: boolean } = {}) {
    if (this.active) throw new Error('Concurrent Prisma query profiling windows forbidden');
    if (!/^[a-z]+(?:-[a-z]+)*$/.test(scenario)) {
      throw new Error('Invalid profile scenario label');
    }
    this.active = {
      scenario,
      samples: [],
      trackTransaction: options.trackTransaction === true,
      transactionControls: { begin: 0, commit: 0, rollback: 0 },
    };
  }

  observe(event: QueryEvent) {
    if (!this.active) return;
    if (this.active.trackTransaction) {
      // Exact allowlisted control statements only; never retain event.query or params.
      // Driver event timing for transaction controls is intentionally not reported.
      const statement = event.query.trim().toUpperCase();
      if (statement === 'BEGIN') {
        this.active.transactionControls.begin++;
        return;
      }
      if (statement === 'COMMIT') {
        this.active.transactionControls.commit++;
        return;
      }
      if (statement === 'ROLLBACK') {
        this.active.transactionControls.rollback++;
        return;
      }
    }
    const safe = sanitizeQuery(event);
    if (safe) this.active.samples.push(safe);
  }

  end(scenario: string) {
    if (!this.active || this.active.scenario !== scenario) {
      throw new Error('Mismatched Prisma query profiling window');
    }
    const { samples, trackTransaction, transactionControls } = this.active;
    this.active = null;
    if (samples.length === 0) throw new Error('No Prisma SELECT query events observed');
    return {
      scenario,
      queryCount: samples.length,
      sql: samples,
      ...(trackTransaction ? { transactionControls } : {}),
    };
  }

  reset() {
    this.active = null;
  }
}
