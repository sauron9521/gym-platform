// Assign whole spec files to independent CI runners. A Playwright invocation
// still runs exactly one spec so its disposable API servers are restarted.
const ciShardCount = 4;
const defaultSpecSeconds = 12;

// Rounded median wall times from eight successful Web integration runs on main
// on 2026-11-25. Each estimate includes the spec's disposable server startup.
const specSeconds = new Map([
  ['athlete-program-assignments.spec.ts', 12],
  ['exercise-privacy.spec.ts', 16],
  ['live-capability-route-guards.spec.ts', 11],
  ['mobile-token-capabilities.spec.ts', 8],
  ['real-api.spec.ts', 10],
  ['notification-settings.spec.ts', 12],
  ['trainer-athlete-decline.spec.ts', 11],
  ['trainer-athlete-lifecycle.spec.ts', 11],
  ['trainer-program-create.spec.ts', 12],
  ['trainer-program-draft-edit.spec.ts', 15],
  ['trainer-program-exercise-create.spec.ts', 13],
  ['trainer-program-list.spec.ts', 10],
  ['trainer-program-published-readonly.spec.ts', 9],
  ['trainer-program-set-create.spec.ts', 12],
  ['trainer-program-set-edit-delete.spec.ts', 12],
  ['trainer-program-set-reorder.spec.ts', 12],
  ['trainer-program-workout-create.spec.ts', 13],
  ['trainer-program-workout-edit-delete.spec.ts', 13],
  ['trainer-web-auth.spec.ts', 23],
  ['trainer-web-inbox.spec.ts', 23],
  ['workout-writes.spec.ts', 13],
]);

export function parseRealApiShardConfig(env = process.env) {
  const index = env.WEB_E2E_SHARD_INDEX;
  const count = env.WEB_E2E_SHARD_COUNT;

  // Local runs still execute every integration spec by default.
  if (index === undefined && count === undefined) {
    return { index: 1, count: 1 };
  }
  if (
    typeof index !== 'string' ||
    typeof count !== 'string' ||
    !/^[1-9][0-9]*$/.test(index) ||
    !/^[1-9][0-9]*$/.test(count)
  ) {
    throw new Error('WEB_E2E_SHARD_INDEX and WEB_E2E_SHARD_COUNT must be positive integers');
  }

  const shardIndex = Number(index);
  const shardCount = Number(count);
  if (
    !Number.isSafeInteger(shardIndex) ||
    !Number.isSafeInteger(shardCount) ||
    shardCount > 32 ||
    shardIndex > shardCount
  ) {
    throw new Error('Invalid real-API browser shard index or count');
  }

  return { index: shardIndex, count: shardCount };
}

function selectBalancedSpecs(specs, index) {
  const byDuration = specs
    .map((spec, position) => ({
      spec,
      position,
      seconds: specSeconds.get(spec) ?? defaultSpecSeconds,
    }))
    .sort((a, b) => b.seconds - a.seconds || a.spec.localeCompare(b.spec, 'en'));
  const totals = Array(ciShardCount).fill(0);
  const selectedPositions = new Set();

  for (const { position, seconds } of byDuration) {
    const shard = totals.indexOf(Math.min(...totals));
    totals[shard] += seconds;
    if (shard === index - 1) selectedPositions.add(position);
  }

  // Preserve the runner's existing spec order within each assigned shard.
  return specs.filter((_, position) => selectedPositions.has(position));
}

export function selectRealApiSpecs(specs, { index, count }) {
  if (!Array.isArray(specs) || specs.length === 0) {
    throw new Error('Real-API browser suite has no integration specs');
  }
  if (
    !Number.isSafeInteger(index) ||
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 32 ||
    index < 1 ||
    index > count
  ) {
    throw new Error('Invalid real-API browser shard configuration');
  }

  const selected =
    count === ciShardCount
      ? selectBalancedSpecs(specs, index)
      : specs.filter((_, position) => position % count === index - 1);
  if (selected.length === 0) {
    throw new Error('Real-API browser shard selected no specs; refusing to silently skip tests');
  }
  return selected;
}
