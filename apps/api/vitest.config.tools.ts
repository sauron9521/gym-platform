import { defineConfig } from 'vitest/config';

// Node-only architecture, coverage, migration and Docker contract suites.
// Keep these separate from the Nest unit and database-backed E2E configs.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/*.test.mjs', 'test/*.test.mjs'],
  },
});
