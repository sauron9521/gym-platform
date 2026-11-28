// Fixed disposable HTTPS route profile. Never accepts a target URL or credentials.
import http from 'k6/http';
import { check } from 'k6';
import { scenario } from 'k6/execution';

const routes = [
  'https://landing.rehearsal.invalid/uk',
  'https://app.rehearsal.invalid/login',
  'https://coach.rehearsal.invalid/login',
  'https://admin.rehearsal.invalid/sign-in',
  'https://api.rehearsal.invalid/health/live',
  'https://api.rehearsal.invalid/health/ready',
  'https://app.rehearsal.invalid/backend/health/ready',
  'https://coach.rehearsal.invalid/backend/health/ready',
  'https://admin.rehearsal.invalid/backend/health/ready',
];
const phases = ['baseline', 'concurrent'];
const thresholds = {
  checks: ['rate==1'],
  http_req_failed: ['rate==0'],
  dropped_iterations: ['count==0'],
};
for (const phase of phases) {
  thresholds['http_req_duration{scenario:' + phase + '}'] = ['p(99)>=0'];
  thresholds['http_reqs{scenario:' + phase + '}'] = ['count>0'];
}
export const options = {
  discardResponseBodies: true,
  maxRedirects: 0,
  insecureSkipTLSVerify: false,
  systemTags: ['scenario', 'status', 'expected_response'],
  summaryTrendStats: ['avg', 'p(50)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    baseline: {
      executor: 'constant-arrival-rate',
      rate: 5,
      timeUnit: '1s',
      duration: '15s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      gracefulStop: '5s',
    },
    concurrent: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '15s',
      startTime: '20s',
      preAllocatedVUs: 4,
      maxVUs: 4,
      gracefulStop: '5s',
    },
  },
  thresholds,
};
export default function () {
  const result = http.get(routes[scenario.iterationInTest % routes.length], {
    redirects: 0,
    timeout: '4s',
  });
  check(result, { 'HTTP 200': (r) => r.status === 200 });
}
export function handleSummary(data) {
  const metrics = data.metrics;
  const phasesReport = phases.map((name) => {
    const latency = metrics['http_req_duration{scenario:' + name + '}']?.values;
    const requests = metrics['http_reqs{scenario:' + name + '}']?.values;
    return {
      name,
      requests: requests?.count,
      latencyMs: latency && {
        p50: latency['p(50)'],
        p95: latency['p(95)'],
        p99: latency['p(99)'],
        max: latency.max,
      },
    };
  });
  return {
    stdout:
      'OVRANTO_LOAD_REPORT ' +
      JSON.stringify({
        schemaVersion: 1,
        phases: phasesReport,
        failedRate: metrics.http_req_failed?.values.rate,
        checkRate: metrics.checks?.values.rate,
        dropped: metrics.dropped_iterations?.values.count ?? 0,
      }) +
      '\n',
  };
}
