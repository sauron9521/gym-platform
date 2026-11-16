export function nodeTestConfig(
  include: string[],
  overrides?: { clearMocks?: boolean },
): {
  test: { environment: 'node'; include: string[]; clearMocks?: boolean };
};
