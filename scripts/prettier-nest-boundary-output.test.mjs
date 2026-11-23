import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { test } from 'vitest';

test('emit canonical formatting for Nest architecture test files', async () => {
  for (const path of [
    '../apps/api/scripts/check-feature-dependencies.test.mjs',
    '../apps/api/scripts/import-parser.test.mjs',
  ]) {
    const filename = fileURLToPath(new URL(path, import.meta.url));
    const text = readFileSync(filename, 'utf8');
    const formatted = await prettier.format(text, {
      ...(await prettier.resolveConfig(filename)),
      filepath: filename,
    });
    console.log('FORMAT_TEST_OUTPUT=' + JSON.stringify({ path, formatted }));
  }
});
