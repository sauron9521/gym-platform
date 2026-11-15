// Assign whole spec files to independent CI runners. A Playwright invocation
// still runs exactly one spec so its disposable API servers are restarted.
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

  const selected = specs.filter((_, position) => position % count === index - 1);
  if (selected.length === 0) {
    throw new Error('Real-API browser shard selected no specs; refusing to silently skip tests');
  }
  return selected;
}
