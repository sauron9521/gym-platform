import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Metro writes large intermediate bundles to the OS temp directory. Keep them
// on the workspace drive, which may have more space than Windows' system drive.
const temporaryDirectory = fileURLToPath(new URL('../.cache/expo-tmp/', import.meta.url));
mkdirSync(temporaryDirectory, { recursive: true });

const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(import.meta.resolve('expo/bin/cli')),
    'export',
    '--platform',
    'web',
    '--output-dir',
    'dist',
  ],
  {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    stdio: 'inherit',
    env: {
      ...process.env,
      TMP: temporaryDirectory,
      TEMP: temporaryDirectory,
      TMPDIR: temporaryDirectory,
    },
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
