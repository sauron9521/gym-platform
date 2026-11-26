/**
 * Initial declarative replacement for a subset of custom import-boundary checks.
 * Existing Nest and workspace architecture guards remain authoritative.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-app-source-imports',
      severity: 'error',
      comment: 'Applications must not import source code from other applications.',
      from: { path: '^apps/([^/]+)/src/' },
      to: { path: '^apps/[^/]+/src/', pathNot: '^apps/$1/' },
    },
    {
      name: 'no-app-source-in-shared-packages',
      severity: 'error',
      comment: 'Shared packages must not depend on application implementation files.',
      from: { path: '^(?:packages|tooling)/[^/]+/src/' },
      to: { path: '^apps/[^/]+/src/' },
    },
    {
      name: 'no-relative-cross-workspace-source-imports',
      severity: 'error',
      comment: 'Use workspace package exports rather than relative paths across workspaces.',
      from: { path: '^((?:apps|packages|tooling)/[^/]+)/src/' },
      to: {
        path: '^(?:apps|packages|tooling)/[^/]+/src/',
        pathNot: '^$1/',
        dependencyTypes: ['local'],
      },
    },
    {
      name: 'no-relative-cross-feature-api-imports',
      severity: 'error',
      comment: 'Use the reviewed #src/modules/<feature> alias for API feature boundaries.',
      from: { path: '^apps/api/src/modules/([^/]+)/' },
      to: {
        path: '^apps/api/src/modules/[^/]+/',
        pathNot: '^apps/api/src/modules/$1/',
        dependencyTypes: ['local'],
      },
    },
    {
      name: 'no-inward-to-api-interface-imports',
      severity: 'error',
      from: { path: '^apps/api/src/(?:modules|common|infra)/' },
      to: { path: '^apps/api/src/api/' },
    },
    {
      name: 'no-cross-audience-api-imports',
      severity: 'error',
      from: { path: '^apps/api/src/api/(public|shared|athlete|trainer|admin)/' },
      to: { path: '^apps/api/src/api/', pathNot: '^apps/api/src/api/$1/' },
    },
    {
      name: 'no-api-interface-private-feature-imports',
      severity: 'error',
      from: { path: '^apps/api/src/api/' },
      to: {
        path: '^apps/api/src/modules/',
        pathNot: '^apps/api/src/modules/[^/]+/(?:[^/]+\\.module|public-api)\\.[cm]?[jt]s$',
      },
    },
    {
      name: 'no-api-interface-database-imports',
      severity: 'error',
      from: { path: '^apps/api/src/api/' },
      to: { path: '^apps/api/src/infra/database/' },
    },
  ],
  options: {
    // Analyze type-only imports before TypeScript compilation removes them.
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    // Source tests remain in scope: the legacy boundary guard scans them too.
    exclude: {
      path: '(^|/)(?:node_modules|\\.next|\\.expo|dist|build|coverage|generated)(/|$)',
    },
  },
};
