import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Keep Metro's temporary and generated bundles on the workspace drive on Windows.
const temporaryDirectory = fileURLToPath(new URL('../.cache/expo-tmp/', import.meta.url));
mkdirSync(temporaryDirectory, { recursive: true });

const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(import.meta.resolve('expo/bin/cli')),
    'export',
    '--platform',
    'ios',
    '--output-dir',
    '.cache/expo-ios',
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
