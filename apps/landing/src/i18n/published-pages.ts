/**
 * Explicit allowlist: only publish English pages whose complete content has
 * been translated. Other Landing pages remain Ukrainian-only until reviewed.
 */
const translatedEnglishPaths = new Set(['/', '/features']);

export function isEnglishPageReady(path: string): boolean {
  return translatedEnglishPaths.has(path);
}
