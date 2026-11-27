import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { reactDomTestAliases } from '../../tooling/vitest/react-dom.mjs';

const rendererPath = createRequire(import.meta.url).resolve('@testing-library/react');

// Server-rendered Admin page output is tested in DOM without changing the Node contracts.
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
    include: ['test/components/**/*.test.tsx'],
    clearMocks: true,
    server: {
      deps: {
        inline: [/use-intl/, /next-intl/, /@tanstack\/react-query/, /@radix-ui/, /@gym\/ui-web/],
      },
    },
    env: { GYM_VITEST_DOM_RENDERER: rendererPath },
    setupFiles: ['../../tooling/vitest/react-dom.setup.mjs'],
  },
});
