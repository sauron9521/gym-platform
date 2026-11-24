import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { reactDomTestAliases } from '../../tooling/vitest/react-dom.mjs';

const rendererPath = createRequire(import.meta.url).resolve('@testing-library/react');

// Isolate client-rendered Landing tests from the existing Node-only SEO suite.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      ...reactDomTestAliases(rendererPath),
    },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'happy-dom',
    server: { deps: { inline: true } },
    include: ['test/components/**/*.test.tsx'],
    clearMocks: true,
    env: { GYM_VITEST_DOM_RENDERER: rendererPath },
    setupFiles: ['../../tooling/vitest/react-dom.setup.mjs'],
  },
});
