import Module, { createRequire } from 'node:module';
import { isAbsolute } from 'node:path';

// Vitest externalizes some CJS dependencies (Next, use-intl, Radix), which
// bypass Vite's resolve.alias. In a hoisted pnpm monorepo where native Expo
// pins a different React patch version, those imports can accidentally load
// a second React dispatcher. This setup is test-only; production is untouched.
// The owning application resolves its declared renderer before starting Vitest.
// Use that same path for both the Vite alias and externalized CommonJS modules.
const rendererPath = process.env.GYM_VITEST_DOM_RENDERER;
if (!rendererPath || !isAbsolute(rendererPath)) {
  throw new Error('Missing absolute GYM_VITEST_DOM_RENDERER from the application Vitest config');
}
const rendererRequire = createRequire(rendererPath);
const reactEntries = new Map(
  ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client'].map(
    (id) => [id, rendererRequire.resolve(id)],
  ),
);
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveReactInDomTests(request, ...args) {
  return reactEntries.get(request) ?? originalResolve.call(this, request, ...args);
};
