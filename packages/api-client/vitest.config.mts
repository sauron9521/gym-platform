import { defineConfig } from 'vitest/config';
import { nodeTestConfig } from '../../tooling/vitest/node.mts';

export default defineConfig(nodeTestConfig(['test/**/*.test.mjs']));
