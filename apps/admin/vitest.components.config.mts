import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { reactDomTestAliases } from '../../tooling/vitest/react-dom.mjs';

// Server-rendered Admin page output is tested in DOM without changing the Node contracts.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      ...reactDomTestAliases(import.meta.url),
    },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'happy-dom',
    include: ['test/components/**/*.test.tsx'],
    clearMocks: true,
    setupFiles: ['../../tooling/vitest/react-dom.setup.mjs'],
  },
});
