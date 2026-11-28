import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const image = 'grafana/k6@sha256:2072ea9eafa596532d9aee0cc0e0a50cfb0e7fb703981a46179af5f4f22c5ea4';
export function validateLoadReport(report) {
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.failedRate, 0);
  assert.equal(report.checkRate, 1);
  assert.equal(report.dropped, 0);
  assert.equal(report.phases.length, 2);
  for (const [i, phase] of report.phases.entries()) {
    assert.equal(phase.name, ['baseline', 'concurrent'][i]);
    // The arrival scheduler can include an iteration at the end boundary.
    const planned = [75, 300][i];
    assert.ok(
      Number.isSafeInteger(phase.requests) &&
        phase.requests >= planned &&
        phase.requests <= planned + 1,
    );
    const { p50, p95, p99, max } = phase.latencyMs;
    assert.ok([p50, p95, p99, max].every((n) => Number.isFinite(n) && n >= 0));
    assert.ok(p50 <= p95 && p95 <= p99 && p99 <= max);
  }
  return report;
}
export async function probeFullStackLoad({ project, directory, output, options }) {
  assert.match(project, /^ovranto-rehearsal-[a-f0-9]{16}$/);
  const docker = (...args) =>
    execFileSync('docker', args, {
      ...options,
      timeout: 20000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const network = JSON.parse(docker('network', 'inspect', project + '_default'))[0];
  assert.equal(network.Internal, true);
  assert.equal(network.Labels['com.docker.compose.project'], project);
  const ids = Object.fromEntries(
    ['api', 'postgres', 'redis'].map((service) => [service, output('ps', '-q', service)]),
  );
  for (const [service, id] of Object.entries(ids)) {
    assert.match(id, /^[a-f0-9]{12,64}$/);
    const info = JSON.parse(docker('inspect', id))[0];
    assert.equal(info.Config.Labels['com.docker.compose.project'], project);
    assert.equal(info.Config.Labels['com.docker.compose.service'], service);
  }
  const script = join(directory, 'full-stack.k6.js'),
    ca = join(directory, 'root.crt');
  copyFileSync(
    fileURLToPath(new URL('../ops/performance/full-stack.k6.js', import.meta.url)),
    script,
  );
  chmodSync(script, 0o644);
  chmodSync(ca, 0o644);
  const name = project + '-k6';
  const args = [
    'run',
    '--rm',
    '--name',
    name,
    '--network',
    project + '_default',
    '--user',
    '12345:12345',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--cpus',
    '1',
    '--memory',
    '256m',
    '--pids-limit',
    '128',
    '--env',
    'SSL_CERT_FILE=/probe/ca.crt',
    '--mount',
    'type=bind,src=' + script + ',dst=/probe/load.js,readonly',
    '--mount',
    'type=bind,src=' + ca + ',dst=/probe/ca.crt,readonly',
    image,
    'run',
    '--quiet',
    '--no-color',
    '/probe/load.js',
  ];
  let stdout = '',
    done = false,
    exitCode;
  const child = spawn('docker', args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
    if (stdout.length > 65536) child.kill();
  });
  const completion = new Promise((resolve) => {
    child.on('error', () => {
      done = true;
      resolve();
    });
    child.on('close', (code) => {
      done = true;
      exitCode = code;
      resolve();
    });
  });
  const peaks = Object.fromEntries(
    Object.keys(ids).map((service) => [service, { cpuPercent: 0, memoryPercent: 0 }]),
  );
  let samples = 0,
    connections = 0;
  try {
    const deadline = Date.now() + 90000;
    while (!done && Date.now() < deadline) {
      const stats = docker('stats', '--no-stream', '--format', '{{json .}}', ...Object.values(ids))
        .split('\n')
        .map(JSON.parse);
      for (const [service, id] of Object.entries(ids)) {
        const row = stats.find((r) => id.startsWith(r.ID));
        assert.ok(row, 'Missing resource sample');
        for (const [key, field] of [
          ['cpuPercent', 'CPUPerc'],
          ['memoryPercent', 'MemPerc'],
        ]) {
          const value = Number(row[field].replace('%', ''));
          assert.ok(Number.isFinite(value) && value >= 0);
          peaks[service][key] = Math.max(peaks[service][key], value);
        }
      }
      const count = Number(
        output(
          'exec',
          '-T',
          'postgres',
          'psql',
          '-X',
          '-Atq',
          '-v',
          'ON_ERROR_STOP=1',
          '-U',
          'rehearsal',
          '-d',
          'gym_rehearsal',
          '-c',
          "SELECT count(*) FROM pg_stat_activity WHERE backend_type='client backend' AND datname=current_database() AND pid<>pg_backend_pid()",
        ),
      );
      assert.ok(Number.isSafeInteger(count) && count >= 0);
      connections = Math.max(connections, count);
      samples++;
      await sleep(2000);
    }
    assert.ok(done, 'Load profile exceeded deadline');
    await completion;
    assert.equal(exitCode, 0, 'k6 profile failed');
    const line = stdout.split('\n').find((s) => s.startsWith('OVRANTO_LOAD_REPORT '));
    assert.ok(line, 'Missing k6 report');
    const report = validateLoadReport(JSON.parse(line.slice('OVRANTO_LOAD_REPORT '.length)));
    assert.ok(samples >= 2, 'Insufficient resource observations');
    console.log(
      'Load rehearsal PASS: ' +
        JSON.stringify({
          report,
          samples,
          observedPeak: peaks,
          observedPeakOtherDbClients: connections,
        }),
    );
  } finally {
    if (!done) {
      child.kill();
      try {
        docker('rm', '-f', name);
      } catch {}
      await completion;
    }
  }
}
