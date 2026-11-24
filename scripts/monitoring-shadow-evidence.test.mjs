import assert from 'node:assert/strict';
import { test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { summarizeShadow, validateShadowSample } from './monitoring-shadow-evidence.mjs';

const id = 'a'.repeat(64);
const labels = (name) => ({ __name__: name, id: '/docker/' + id, job: 'gym-resource-shadow' });
function fixture() {
  const result = [
    { metric: labels('container_last_seen'), value: [100, '95'] },
    { metric: labels('gym_shadow:cpu_percent'), value: [100, '100'] },
    { metric: labels('gym_shadow:memory_percent'), value: [100, '50'] },
  ];
  return {
    fixtureId: id,
    diagnosticsClean: true,
    series: { status: 'success', data: result.map((x) => x.metric) },
    samples: ['idle', 'cpu', 'memory'].map((phase) => ({
      phase,
      time: 100,
      before: 90,
      reference: 'gym_api_docker_cpu_percent 98\ngym_api_docker_memory_percent 49\n',
      query: { status: 'success', data: { resultType: 'vector', result: structuredClone(result) } },
    })),
  };
}
test('publishes only numeric observations, not container identities or raw labels', () => {
  const r = summarizeShadow(fixture());
  assert.equal(r.status, 'observed-not-parity');
  assert.equal(r.observations[0].comparisons[0].difference, 2);
  assert.equal(r.observations[0].comparisons[2].difference, null);
  assert.ok(!JSON.stringify(r).includes(id));
});
test('rejects decoy identities, private labels and failed diagnostic checks', () => {
  for (const change of [
    (f) => {
      f.series.data[0].id = '/docker/' + 'b'.repeat(64);
    },
    (f) => {
      f.series.data[0].secret = 'FAKE_PRIVATE';
    },
    (f) => {
      f.diagnosticsClean = false;
    },
    (f) => {
      f.samples[0].query.data.result[0].metric.image = 'private';
    },
    (f) => {
      f.samples[0].query.data.result.push(f.samples[0].query.data.result[0]);
    },
    (f) => {
      f.samples[0].reference += 'secret 1\n';
    },
  ]) {
    const f = fixture();
    change(f);
    assert.throws(() => summarizeShadow(f));
  }
});
test('stale or missing data remains inconclusive, never a zero difference', () => {
  const f = fixture();
  f.samples[0].query.data.result[0].value[1] = '20';
  f.samples[1].query.data.result = [];
  const r = summarizeShadow(f);
  assert.equal(r.status, 'inconclusive');
  assert.equal(r.observations[0].comparisons[0].difference, null);
  assert.equal(r.observations[1].comparisons[0].candidate, null);
});

test('distinguishes structural failures without echoing private input', () => {
  const cases = [
    [
      (s) => {
        s.query.data.result[0].metric.secret = 'PRIVATE_SENTINEL';
      },
      'SHADOW_LABEL_NOT_ALLOWED',
    ],
    [
      (s) => {
        s.query.data.result[0].metric.id = '/docker/' + 'b'.repeat(64);
      },
      'SHADOW_ID_MISMATCH',
    ],
    [
      (s) => {
        s.query.data.result[0].metric.__name__ = 'PRIVATE_SENTINEL';
      },
      'SHADOW_METRIC_NOT_ALLOWED',
    ],
    [
      (s) => {
        s.query.data.result[0].metric.job = 'PRIVATE_SENTINEL';
      },
      'SHADOW_JOB_MISMATCH',
    ],
    [
      (s) => {
        s.query.data.result[0].metric.cpu = 'PRIVATE_SENTINEL';
      },
      'SHADOW_CPU_LABEL',
    ],
    [
      (s) => {
        s.query.data.result.push(s.query.data.result[0]);
      },
      'SHADOW_DUPLICATE_METRIC',
    ],
    [
      (s) => {
        s.query.data.result[0].value[1] = 'NaN';
      },
      'SHADOW_SAMPLE_VALUE',
    ],
    [
      (s) => {
        s.query.data.result[0].value[0] = 101;
      },
      'SHADOW_SAMPLE_TIME',
    ],
    [
      (s) => {
        s.reference += 'PRIVATE_SENTINEL 1\n';
      },
      'SHADOW_REFERENCE_METRIC',
    ],
  ];
  for (const [mutate, code] of cases) {
    const f = fixture();
    const s = f.samples[0];
    mutate(s);
    assert.throws(() => validateShadowSample(s, f.fixtureId), {
      message: code,
      code,
      phase: 'idle',
    });
  }
});

test('early sample CLI prints fixed codes and never emits private values or a report', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shadow-evidence-'));
  try {
    const f = fixture();
    const s = f.samples[0];
    writeFileSync(join(dir, 'id'), f.fixtureId);
    writeFileSync(join(dir, 'time'), String(s.time));
    writeFileSync(join(dir, 'before'), String(s.before));
    writeFileSync(join(dir, 'reference.txt'), s.reference);
    writeFileSync(join(dir, 'query.json'), JSON.stringify(s.query));
    const script = new URL('./monitoring-shadow-evidence.mjs', import.meta.url);
    const args = [script.pathname, '--check-sample', join(dir, 'id'), 'idle', dir];
    const good = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(good.status, 0);
    assert.match(good.stdout, /idle; candidate freshness: fresh/);
    s.query.data.result[0].metric.secret = 'PRIVATE_SENTINEL';
    writeFileSync(join(dir, 'query.json'), JSON.stringify(s.query));
    const bad = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /SHADOW_LABEL_NOT_ALLOWED \(idle\)/);
    assert.doesNotMatch(bad.stderr + bad.stdout, /PRIVATE_SENTINEL|aaaaaaaaaa/);
    writeFileSync(join(dir, 'input.json'), JSON.stringify(f));
    const final = spawnSync(
      process.execPath,
      [script.pathname, join(dir, 'input.json'), join(dir, 'report.json')],
      { encoding: 'utf8' },
    );
    assert.equal(final.status, 1);
    assert.equal(existsSync(join(dir, 'report.json')), false);
    assert.doesNotMatch(final.stderr + final.stdout, /PRIVATE_SENTINEL|aaaaaaaaaa/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
