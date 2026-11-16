// Shared Node-runtime Vitest defaults for contract and tooling tests.
// Native React component tests and database E2E keep their own configs.
export function nodeTestConfig(include: string[], overrides: { clearMocks?: boolean } = {}) {
  return {
    test: {
      environment: 'node' as const,
      include,
      ...overrides,
    },
  };
}
