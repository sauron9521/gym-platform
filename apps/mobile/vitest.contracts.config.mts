import { defineConfig } from 'vitest/config';
import { nodeTestConfig } from '../../tooling/vitest/node.mjs';

// Keep Node contracts isolated from the native React renderer test plugin.
export default defineConfig(nodeTestConfig(['test/*.test.mjs'], { clearMocks: true }));
