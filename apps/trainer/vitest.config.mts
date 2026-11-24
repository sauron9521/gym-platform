import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import { reactDomTestAliases } from '../../tooling/vitest/react-dom.mjs';

const rendererPath = createRequire(import.meta.url).resolve('@testing-library/react');

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      ...reactDomTestAliases(rendererPath),
    },
  },
  test: {
    clearMocks: true,
    env: { GYM_VITEST_DOM_RENDERER: rendererPath },
    setupFiles: ['../../tooling/vitest/react-dom.setup.mjs'],
  },
});
