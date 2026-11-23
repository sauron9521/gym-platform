import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { test } from 'vitest';

test('emit canonical formatting for Nest runtime DI smoke', async () => {
  const path = '../apps/api/test/e2e/infra/app.e2e-spec.ts';
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const source = readFileSync(filename, 'utf8');
  const formatted = await prettier.format(source, {
    ...(await prettier.resolveConfig(filename)),
    filepath: filename,
  });
  console.log('FORMAT_TEST_OUTPUT=' + JSON.stringify({ path, formatted }));
});
