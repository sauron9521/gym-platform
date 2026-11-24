import { defineConfig } from 'vitest/config';
import { nodeTestConfig } from '../../tooling/vitest/node.mjs';

export default defineConfig(nodeTestConfig(['test/**/*.test.mjs', 'test/**/*.spec.mts']));
