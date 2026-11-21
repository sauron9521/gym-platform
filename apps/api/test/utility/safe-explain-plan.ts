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
  const type = node['Node Type'];
  const result: SanitizedNode = {
    nodeType: typeof type === 'string' && SAFE_NODE_TYPES.has(type) ? type : 'Unknown',
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

const SAFE_NODE_TYPES = new Set([
  'Aggregate',
  'Append',
  'Bitmap Heap Scan',
  'Bitmap Index Scan',
  'BitmapAnd',
  'BitmapOr',
  'CTE Scan',
  'Foreign Scan',
  'Function Scan',
  'Gather',
  'Gather Merge',
  'Group',
  'Hash',
  'Hash Join',
  'Incremental Sort',
  'Index Only Scan',
  'Index Scan',
  'Limit',
  'Materialize',
  'Memoize',
  'Merge Append',
  'Merge Join',
  'Nested Loop',
  'Result',
  'Seq Scan',
  'Sort',
  'Subquery Scan',
  'Tid Scan',
  'Unique',
  'Values Scan',
  'WindowAgg',
  'WorkTable Scan',
]);

function diagnosticRow(node: SanitizedNode, depth: number) {
  return {
    nodeType: node.nodeType,
    ...(node.relation === undefined ? {} : { relation: node.relation }),
    ...(node.index === undefined ? {} : { index: node.index }),
    depth,
    ...(node.planRows === undefined ? {} : { planRows: node.planRows }),
    ...(node.actualRows === undefined ? {} : { actualRows: node.actualRows }),
    ...(node.loops === undefined ? {} : { loops: node.loops }),
    ...(node.sharedHitBlocks === undefined ? {} : { sharedHitBlocks: node.sharedHitBlocks }),
    ...(node.sharedReadBlocks === undefined ? {} : { sharedReadBlocks: node.sharedReadBlocks }),
  };
}

const DIAGNOSTIC_LIMIT = 4;

/**
 * Derived only from the sanitized tree. All row counts in PostgreSQL
 * EXPLAIN ANALYZE nodes are PER LOOP, not multiplied by actual loops.
 * Buffer counters on parent nodes include descendants; NEVER sum them.
 * This is diagnostic context, not a performance pass/fail threshold.
 */
export function summarizeExplainDiagnostics(report: ReturnType<typeof sanitizeExplain>) {
  const nodes: Array<{ node: SanitizedNode; depth: number }> = [];

  function visit(node: SanitizedNode, depth: number): void {
    nodes.push({ node, depth });
    for (const child of node.children ?? []) visit(child, depth + 1);
  }
  visit(report.root, 0);

  const scans = nodes.filter(({ node }) => node.nodeType.endsWith('Scan'));
  const bufferBlocks = (node: SanitizedNode) =>
    (node.sharedHitBlocks ?? 0) + (node.sharedReadBlocks ?? 0);

  const repeatedIndexScans = scans
    .filter(
      ({ node }) =>
        ['Index Scan', 'Index Only Scan'].includes(node.nodeType) &&
        node.loops !== undefined &&
        node.loops > 1,
    )
    .sort((a, b) => (b.node.loops ?? 0) - (a.node.loops ?? 0))
    .slice(0, DIAGNOSTIC_LIMIT)
    .map(({ node, depth }) => diagnosticRow(node, depth));

  const highBufferScans = scans
    .filter(({ node }) => bufferBlocks(node) > 0)
    .sort((a, b) => bufferBlocks(b.node) - bufferBlocks(a.node))
    .slice(0, DIAGNOSTIC_LIMIT)
    .map(({ node, depth }) => diagnosticRow(node, depth));

  // Filter Sort/Limit/Aggregate: their row counts can be altered by LIMIT or
  // aggregation and are not equivalent to a base relation's row estimate.
  const rowEstimateOutliers = nodes
    .filter(
      ({ node }) =>
        (node.nodeType.endsWith('Scan') ||
          node.nodeType.includes('Join') ||
          node.nodeType === 'Nested Loop') &&
        node.planRows !== undefined &&
        node.planRows > 0 &&
        node.actualRows !== undefined &&
        node.actualRows > 0,
    )
    .map(({ node, depth }) => ({
      ...diagnosticRow(node, depth),
      estimateFactor:
        Math.round(
          Math.max(node.planRows! / node.actualRows!, node.actualRows! / node.planRows!) * 100,
        ) / 100,
    }))
    .sort((a, b) => b.estimateFactor - a.estimateFactor)
    .slice(0, DIAGNOSTIC_LIMIT);

  return {
    nodeCount: nodes.length,
    scanNodeCount: scans.length,
    repeatedIndexScans,
    highBufferScans,
    rowEstimateOutliers,
  };
}
