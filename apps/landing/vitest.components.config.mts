import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Isolate client-rendered Landing tests from the existing Node-only SEO suite.
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
