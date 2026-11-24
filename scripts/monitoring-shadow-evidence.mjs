// Read-only evidence sanitizer for the isolated resource pilot. No live calls.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const native = [
  'container_cpu_usage_seconds_total',
  'container_cpu_cfs_periods_total',
  'container_cpu_cfs_throttled_periods_total',
  'container_cpu_cfs_throttled_seconds_total',
  'container_memory_working_set_bytes',
  'container_spec_memory_limit_bytes',
  'container_threads',
  'container_oom_events_total',
  'container_last_seen',
];
const derived = [
  'gym_shadow:cpu_percent',
  'gym_shadow:memory_percent',
  'gym_shadow:throttled_period_ratio',
];
const referenceNames = [
  'gym_api_docker_cpu_percent',
  'gym_api_docker_memory_percent',
  'gym_api_docker_pids',
  'gym_api_docker_running',
  'gym_api_docker_restart_count',
  'gym_api_docker_oom_killed',
  'gym_api_docker_oom_events_window_10m',
  'gym_api_docker_cpu_periods_total',
  'gym_api_docker_cpu_throttled_periods_total',
  'gym_api_docker_cpu_throttled_seconds_total',
  'gym_api_docker_last_sample_timestamp_seconds',
  'gym_api_docker_signals_last_sample_timestamp_seconds',
];

// Only constant codes reach public CI logs. Never interpolate input values.
class ShadowEvidenceError extends Error {
  constructor(code, phase = 'series') {
    super(code);
    this.code = code;
    this.phase = phase;
  }
}

const reject = (code, phase) => {
  throw new ShadowEvidenceError(code, phase);
};

function checkLabels(labels, fixtureId, phase) {
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
    reject('SHADOW_LABEL_SHAPE', phase);
  }
  if (Object.keys(labels).some((key) => !['__name__', 'id', 'cpu', 'job'].includes(key))) {
    reject('SHADOW_LABEL_NOT_ALLOWED', phase);
  }
  if (![...native, ...derived].includes(labels.__name__)) {
    reject('SHADOW_METRIC_NOT_ALLOWED', phase);
  }
  if (labels.job !== 'gym-resource-shadow') {
    reject('SHADOW_JOB_MISMATCH', phase);
  }
  if (
    !['/docker/' + fixtureId, '/system.slice/docker-' + fixtureId + '.scope'].includes(labels.id)
  ) {
    reject('SHADOW_ID_MISMATCH', phase);
  }
  if (
    labels.cpu !== undefined &&
    (labels.cpu !== 'total' ||
      !['container_cpu_usage_seconds_total', 'gym_shadow:cpu_percent'].includes(labels.__name__))
  ) {
    reject('SHADOW_CPU_LABEL', phase);
  }
}

function readVector(response, fixtureId, phase) {
  if (
    response?.status !== 'success' ||
    response.data?.resultType !== 'vector' ||
    !Array.isArray(response.data.result) ||
    response.data.result.length > 32
  ) {
    reject('SHADOW_QUERY_SHAPE', phase);
  }
  const result = {};
  for (const item of response.data.result) {
    checkLabels(item?.metric, fixtureId, phase);
    const name = item.metric.__name__;
    if (Object.hasOwn(result, name)) reject('SHADOW_DUPLICATE_METRIC', phase);
    if (
      !Array.isArray(item.value) ||
      item.value.length !== 2 ||
      !Number.isFinite(item.value[0]) ||
      typeof item.value[1] !== 'string' ||
      item.value[1].trim() === '' ||
      !Number.isFinite(Number(item.value[1]))
    ) {
      reject('SHADOW_SAMPLE_VALUE', phase);
    }
    result[name] = { value: Number(item.value[1]), evaluatedAt: item.value[0] };
  }
  return result;
}

function readReference(text, phase) {
  if (typeof text !== 'string') reject('SHADOW_REFERENCE_SHAPE', phase);
  const result = {};
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [name, value, ...rest] = line.split(' ');
    if (!referenceNames.includes(name)) {
      // Running-state signal has the same meaning as the resource gauge.
      if (name === 'gym_api_docker_signals_running' && ['0', '1'].includes(value) && !rest.length)
        continue;
      reject('SHADOW_REFERENCE_METRIC', phase);
    }
    if (rest.length || !value || !Number.isFinite(Number(value)) || Object.hasOwn(result, name)) {
      reject('SHADOW_REFERENCE_VALUE', phase);
    }
    result[name] = Number(value);
  }
  return result;
}

export function validateShadowSample(sample, fixtureId) {
  const phase = sample?.phase;
  if (
    !['idle', 'cpu', 'memory'].includes(phase) ||
    typeof fixtureId !== 'string' ||
    !/^[a-f0-9]{64}$/.test(fixtureId)
  ) {
    reject('SHADOW_ENVELOPE', 'report');
  }
  const candidate = readVector(sample.query, fixtureId, phase);
  const reference = readReference(sample.reference, phase);
  const lastSeen = candidate.container_last_seen?.value ?? null;
  const evaluation = sample.time;
  if (
    !Number.isFinite(evaluation) ||
    !Number.isFinite(sample.before) ||
    sample.before > evaluation ||
    evaluation - sample.before > 60 ||
    Object.values(candidate).some((v) => v.evaluatedAt !== evaluation)
  ) {
    reject('SHADOW_SAMPLE_TIME', phase);
  }
  const fresh = lastSeen !== null && evaluation - lastSeen >= -5 && evaluation - lastSeen <= 60;
  return { candidate, reference, lastSeen, evaluation, fresh };
}

export function summarizeShadow({ fixtureId, series, samples, diagnosticsClean }) {
  if (
    typeof fixtureId !== 'string' ||
    !/^[a-f0-9]{64}$/.test(fixtureId) ||
    series?.status !== 'success' ||
    !Array.isArray(series.data) ||
    series.data.length > 32 ||
    diagnosticsClean !== true ||
    !Array.isArray(samples) ||
    samples.map((s) => s.phase).join(',') !== 'idle,cpu,memory'
  ) {
    reject('SHADOW_ENVELOPE', 'report');
  }
  for (const labels of series.data) checkLabels(labels, fixtureId, 'series');
  const observations = samples.map((sample) => {
    const { candidate, reference, lastSeen, evaluation, fresh } = validateShadowSample(
      sample,
      fixtureId,
    );
    const comparisons = [
      ['cpuPercent', 'gym_api_docker_cpu_percent', 'gym_shadow:cpu_percent'],
      ['memoryPercent', 'gym_api_docker_memory_percent', 'gym_shadow:memory_percent'],
      ['pids', 'gym_api_docker_pids', 'container_threads'],
      ['cpuPeriods', 'gym_api_docker_cpu_periods_total', 'container_cpu_cfs_periods_total'],
      [
        'throttledPeriods',
        'gym_api_docker_cpu_throttled_periods_total',
        'container_cpu_cfs_throttled_periods_total',
      ],
      [
        'throttledSeconds',
        'gym_api_docker_cpu_throttled_seconds_total',
        'container_cpu_cfs_throttled_seconds_total',
      ],
    ].map(([metric, ref, shadow]) => {
      const a = reference[ref] ?? null;
      const b = candidate[shadow]?.value ?? null;
      return {
        metric,
        reference: a,
        candidate: b,
        difference: fresh && a !== null && b !== null ? b - a : null,
      };
    });
    return {
      phase: sample.phase,
      before: sample.before,
      evaluatedAt: evaluation,
      lastSeen,
      fresh,
      comparisons,
      reference,
      candidate: Object.fromEntries(
        Object.entries(candidate).map(([name, item]) => [name, item.value]),
      ),
    };
  });
  const usable =
    series.data.length > 0 &&
    observations.every(
      (o) =>
        o.fresh &&
        o.comparisons.slice(0, 2).every((m) => m.reference !== null && m.candidate !== null),
    );
  return {
    schema: 1,
    status: usable ? 'observed-not-parity' : 'inconclusive',
    privacyCheck: 'allowlisted-series-and-sentinel-check',
    observations,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [input, output, phase, dir] = process.argv.slice(2);
    if (input === '--check-sample') {
      const read = (name) => readFileSync(join(dir, name), 'utf8');
      const observation = validateShadowSample(
        {
          phase,
          time: Number(read('time')),
          before: Number(read('before')),
          reference: read('reference.txt'),
          query: JSON.parse(read('query.json')),
        },
        readFileSync(output, 'utf8').trim(),
      );
      process.stdout.write(
        'Shadow phase validation: ' +
          phase +
          '; candidate freshness: ' +
          (observation.fresh ? 'fresh' : 'missing-or-stale') +
          '\n',
      );
    } else {
      const result = summarizeShadow(JSON.parse(readFileSync(input, 'utf8')));
      writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      if (result.status === 'inconclusive') process.exitCode = 2;
    }
  } catch (error) {
    const reason =
      error instanceof ShadowEvidenceError
        ? error.code + ' (' + error.phase + ')'
        : 'SHADOW_IO_OR_JSON';
    process.stderr.write('Shadow evidence rejected: ' + reason + '; no raw data published\n');
    process.exitCode = 1;
  }
}
