import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appDirectory = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(import.meta.resolve('expo/bin/cli'));
const temporaryDirectory = fileURLToPath(new URL('../.cache/expo-tmp/', import.meta.url));
mkdirSync(temporaryDirectory, { recursive: true });

const port = 19089;
const baseUrl = `http://127.0.0.1:${port}`;
const readyTimeoutMs = 120_000;
const bundleTimeoutMs = 210_000;
const startTime = Date.now();
let exited = false;
let recentLogs = '';

const server = spawn(
  process.execPath,
  [cli, 'start', '--offline', '--localhost', '--port', String(port), '--clear'],
  {
    cwd: appDirectory,
    env: {
      ...process.env,
      CI: '1',
      EXPO_OFFLINE: '1',
      EXPO_NO_TELEMETRY: '1',
      TMP: temporaryDirectory,
      TEMP: temporaryDirectory,
      TMPDIR: temporaryDirectory,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

function capture(chunk) {
  const output = chunk.toString();
  process.stdout.write(output);
  recentLogs = (recentLogs + output).slice(-10000);
}

server.stdout.on('data', capture);
server.stderr.on('data', capture);
server.on('error', (error) => {
  exited = true;
  capture(error.message);
});
server.on('exit', () => {
  exited = true;
});

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

try {
  while (true) {
    if (exited) throw new Error('Expo CLI exited before Metro became ready.');
    if (Date.now() - startTime > readyTimeoutMs) {
      throw new Error('Timed out waiting for the Metro development server.');
    }

    try {
      const status = await fetch(`${baseUrl}/status`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (status.ok && (await status.text()).includes('packager-status:running')) break;
    } catch {
      // Server has not started listening yet.
    }

    await pause(750);
  }

  // Native dev=true uses the HMR and async-require implementations that
  // production iOS export cannot exercise.
  const url = `${baseUrl}/index.bundle?platform=ios&dev=true&hot=true&minify=false`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(bundleTimeoutMs),
  });
  const bundle = await response.text();
  if (!response.ok || !bundle.includes('__d(')) {
    throw new Error(
      `Native iOS dev bundle returned HTTP ${response.status}: ${bundle.slice(0, 1500)}`,
    );
  }

  console.log(`iOS native dev bundle succeeded (${bundle.length} characters).`);
} catch (error) {
  console.error(error);
  console.error(recentLogs);
  process.exitCode = 1;
} finally {
  if (process.platform === 'win32' && server.pid) {
    // Stop the process tree even when Expo starts Metro in a child process.
    spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    server.kill('SIGTERM');
  }
}
