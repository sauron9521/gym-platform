/** Allowlisted PostgreSQL EXPLAIN summary. Never serialize raw SQL predicates or bind values. */
type PlanNode = Record<string, unknown>;
type RawPlan = {
  Plan: PlanNode;
  'Planning Time'?: number;
  'Execution Time'?: number;
};

export type ExplainRow = { 'QUERY PLAN': RawPlan[] | string };

export type SanitizedNode = {
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
  for (const [source, target] of [
    ['Relation Name', 'relation'],
    ['Index Name', 'index'],
  ] as const) {
    const value = node[source];
    if (typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
      result[target] = value;
    }
  }
  for (const [source, target] of [
    ['Plan Rows', 'planRows'],
    ['Actual Rows', 'actualRows'],
    ['Actual Loops', 'loops'],
    ['Actual Total Time', 'actualTotalTimeMs'],
    ['Shared Hit Blocks', 'sharedHitBlocks'],
    ['Shared Read Blocks', 'sharedReadBlocks'],
  ] as const) {
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

export function sanitizeExplain(rows: ExplainRow[]) {
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
