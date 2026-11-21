import { createRequire } from 'node:module';
import { dirname } from 'node:path';

/**
 * Match the React singleton that the DOM renderer uses in Vitest.
 * Expo Mobile pins the SDK-tested React version independently from Next apps,
 * so pnpm may hoist another React instance at the workspace root.
 */
export function reactDomTestAliases(importerUrl) {
  const appRequire = createRequire(importerUrl);
  const rendererRequire = createRequire(appRequire.resolve('@testing-library/react'));

  return {
    react: dirname(rendererRequire.resolve('react/package.json')),
    'react-dom': dirname(rendererRequire.resolve('react-dom/package.json')),
  };
}
