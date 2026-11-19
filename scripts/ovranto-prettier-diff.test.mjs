import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import prettier from 'prettier';
import { test } from 'vitest';

test('temporary: exact Prettier diff for OVRANTO Mobile contract test', async () => {
  const path = resolve('apps/mobile/test/ui-foundation.test.mjs');
  const before = readFileSync(path, 'utf8');
  const after = await prettier.format(before, {
    ...(await prettier.resolveConfig(path)),
    filepath: path,
  });
  const folder = mkdtempSync(join(tmpdir(), 'ovranto-format-'));
  const oldFile = join(folder, 'before');
  const newFile = join(folder, 'after');
  writeFileSync(oldFile, before);
  writeFileSync(newFile, after);
  const result = spawnSync('diff', ['-u', oldFile, newFile], { encoding: 'utf8' });
  console.log('OVRANTO_EXACT_PRETTIER_DIFF\n' + result.stdout);
  rmSync(folder, { recursive: true, force: true });
});
