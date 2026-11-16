import { defineConfig } from 'vitest/config';

// Node-only contract checks must not load the React Native transformer.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/*.test.mjs'],
    clearMocks: true,
  },
});
