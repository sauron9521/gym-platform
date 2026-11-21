import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { reactDomTestAliases } from '../../tooling/vitest/react-dom.mjs';

// Isolate client-rendered Landing tests from the existing Node-only SEO suite.
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
    server: { deps: { inline: true } },
    include: ['test/components/**/*.test.tsx'],
    clearMocks: true,
    setupFiles: ['../../tooling/vitest/react-dom.setup.mjs'],
  },
});
