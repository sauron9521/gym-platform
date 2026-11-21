import Module, { createRequire } from 'node:module';

// Vitest externalizes some CJS dependencies (Next, use-intl, Radix), which
// bypass Vite's resolve.alias. In a hoisted pnpm monorepo where native Expo
// pins a different React patch version, those imports can accidentally load
// a second React dispatcher. This setup is test-only; production is untouched.
const require = createRequire(import.meta.url);
const rendererRequire = createRequire(require.resolve('@testing-library/react'));
const reactEntries = new Map(
  ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client'].map(
    (id) => [id, rendererRequire.resolve(id)],
  ),
);
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveReactInDomTests(request, ...args) {
  return reactEntries.get(request) ?? originalResolve.call(this, request, ...args);
};
