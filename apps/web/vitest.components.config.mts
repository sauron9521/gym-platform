import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Keep real DOM-component tests isolated from the existing Node contract suite.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'happy-dom',
    include: ['test/components/**/*.test.tsx'],
    clearMocks: true,
  },
});
