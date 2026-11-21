import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import { reactDomTestAliases } from '../../tooling/vitest/react-dom.mjs';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      ...reactDomTestAliases(import.meta.url),
    },
  },
  test: {
    clearMocks: true,
    setupFiles: ['../../tooling/vitest/react-dom.setup.mjs'],
  },
});
