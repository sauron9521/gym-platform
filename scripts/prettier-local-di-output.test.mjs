import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { test } from 'vitest';

test('emit canonical formatting for local DI guard files', async () => {
  for (const path of [
    '../apps/api/scripts/check-feature-dependencies.mjs',
    '../apps/api/scripts/check-feature-dependencies.test.mjs',
  ]) {
    const filename = fileURLToPath(new URL(path, import.meta.url));
    const source = readFileSync(filename, 'utf8');
    const formatted = await prettier.format(source, {
      ...(await prettier.resolveConfig(filename)),
      filepath: filename,
    });
    console.log('FORMAT_TEST_OUTPUT=' + JSON.stringify({ path, formatted }));
  }
});
