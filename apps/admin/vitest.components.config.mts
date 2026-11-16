import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Server-rendered Admin page output is tested in DOM without changing the Node contracts.
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
