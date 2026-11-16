import { defineConfig } from 'vitest/config';
import { nodeTestConfig } from '../../tooling/vitest/node.mts';

// Keep Node tooling contracts separate from Nest units and database E2E.
export default defineConfig(nodeTestConfig(['scripts/*.test.mjs', 'test/*.test.mjs']));
