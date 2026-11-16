import { defineConfig } from 'vitest/config';
import { nodeTestConfig } from './tooling/vitest/node.mts';

// Repository-level CI, safety, release, backup and monitoring contract tests.
export default defineConfig(nodeTestConfig(['scripts/*.test.mjs'], { clearMocks: true }));
