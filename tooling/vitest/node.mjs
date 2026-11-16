export function nodeTestConfig(include, overrides = {}) {
  return {
    test: {
      environment: 'node',
      include,
      ...overrides,
    },
  };
}
