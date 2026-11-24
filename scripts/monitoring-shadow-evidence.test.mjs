import assert from 'node:assert/strict';
import { test } from 'vitest';
import { summarizeShadow } from './monitoring-shadow-evidence.mjs';

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
