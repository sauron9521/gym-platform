import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

export const API_PERFORMANCE_ROUTES = Object.freeze([
  { name: 'users-me', path: '/users/me' },
  { name: 'workouts-summary', path: '/workouts?view=summary&limit=20' },
  { name: 'training-programs', path: '/training-programs?limit=20' },
  { name: 'exercises', path: '/exercises?limit=20' },
]);

function boundedInteger(value, fallback, key, min, max) {
  if (value === undefined || value === '') return fallback;
  if (!/^[0-9]+$/.test(value)) throw new Error(`${key} must be an integer from ${min} to ${max}`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`${key} must be an integer from ${min} to ${max}`);
  }
  return number;
}

/** Only a local, explicitly provisioned development/test API can be benchmarked. */
export function validateBaseUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'API_PERF_BASE_URL must be a loopback HTTP origin without credentials or a path',
    );
  }
  return url.origin;
}

export function readBaselineConfig(env = process.env) {
  const token = env.API_PERF_TOKEN;
  if (!token || !token.trim()) {
    throw new Error('API_PERF_TOKEN is required for authenticated API reads');
  }
  if (/[^\x21-\x7e]/.test(token)) throw new Error('API_PERF_TOKEN has invalid characters');
  const requested = env.API_PERF_ROUTES?.trim() ?? 'all';
  const names =
    requested === 'all' ? API_PERFORMANCE_ROUTES.map((route) => route.name) : requested.split(',');
  if (!names.length || new Set(names).size !== names.length) {
    throw new Error('API_PERF_ROUTES must list unique supported route names');
  }
  const routes = names.map((name) => {
    const route = API_PERFORMANCE_ROUTES.find((item) => item.name === name);
    if (!route) throw new Error(`Unsupported API_PERF_ROUTES entry: ${name}`);
    return route;
  });

  return {
    baseUrl: validateBaseUrl(env.API_PERF_BASE_URL ?? 'http://127.0.0.1:3001'),
    token,
    routes,
    samples: boundedInteger(env.API_PERF_SAMPLES, 25, 'API_PERF_SAMPLES', 1, 40),
    warmup: boundedInteger(env.API_PERF_WARMUP, 2, 'API_PERF_WARMUP', 0, 5),
    pauseMs: boundedInteger(env.API_PERF_PAUSE_MS, 150, 'API_PERF_PAUSE_MS', 0, 5000),
  };
}

export function nearestRank(values, percentile) {
  if (!values.length) throw new Error('No samples to summarize');
  if (percentile <= 0 || percentile > 100) throw new Error('Invalid percentile');
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil((percentile / 100) * sorted.length) - 1];
}

function summarize(values) {
  return {
    min: Math.min(...values),
    p50: nearestRank(values, 50),
    p95: nearestRank(values, 95),
    max: Math.max(...values),
  };
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runBaseline(config, request = fetch) {
  const results = [];
  for (const route of config.routes) {
    const latencies = [];
    const responseBytes = [];
    for (let iteration = 0; iteration < config.warmup + config.samples; iteration++) {
      const start = performance.now();
      // No mutation methods, redirect following, user-controlled routes or response logging.
      const response = await request(config.baseUrl + route.path, {
        method: 'GET',
        headers: { accept: 'application/json', authorization: `Bearer ${config.token}` },
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      const body = await response.arrayBuffer();
      const elapsedMs = performance.now() - start;
      if (response.status !== 200) {
        throw new Error(
          `${route.name}: expected HTTP 200, received HTTP ${response.status}; response body omitted`,
        );
      }
      if (iteration >= config.warmup) {
        latencies.push(Number(elapsedMs.toFixed(3)));
        responseBytes.push(body.byteLength);
      }
      if (config.pauseMs) await pause(config.pauseMs);
    }
    results.push({
      route: route.name,
      method: 'GET',
      path: route.path,
      samples: config.samples,
      latencyMs: summarize(latencies),
      decodedResponseBytes: summarize(responseBytes),
    });
  }

  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    nodeVersion: process.version,
    methodology: {
      concurrency: 1,
      warmupPerRoute: config.warmup,
      samplesPerRoute: config.samples,
      pauseMs: config.pauseMs,
      latency: 'elapsed time through complete response body read',
      bytes: 'decoded response body size, not network transfer bytes',
    },
    results,
  };
}

async function main() {
  try {
    const config = readBaselineConfig();
    const result = await runBaseline(config);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) {
    process.stderr.write(
      `API baseline failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
