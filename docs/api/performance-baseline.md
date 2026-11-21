# API performance baseline (Issue #313)

This first slice provides a **read-only, sequential HTTP sampling harness** for a
local API using disposable or synthetic test data. It captures reproducible
latency and decoded response sizes for four critical read paths. It does **not**
change HTTP contracts, Prisma schema, migrations, indexes or caching.

## Routes and fixture ownership

| Key                 | GET route                         | Why measure                          |
| ------------------- | --------------------------------- | ------------------------------------ |
| `users-me`          | `/users/me`                       | Authenticated user/profile read      |
| `workouts-summary`  | `/workouts?view=summary&limit=20` | Athlete workout list in compact view |
| `training-programs` | `/training-programs?limit=20`     | Accessible training program list     |
| `exercises`         | `/exercises?limit=20`             | Global/private exercise catalog read |

Use one **disposable PostgreSQL test dataset**, fixed account capabilities,
identical seeded row counts, and an unexpired bearer access token for that
account. Capture the dataset seed revision, API commit SHA, PostgreSQL version,
machine specification and configuration beside the report. Never put real user
records or a credential into committed artifacts.

## Local collection

Start a local API on `127.0.0.1:3001` backed by a **test** database. Obtain a
valid access token using the normal test login flow; supply it only through an
environment variable (never via a CLI argument). Do not run against production.

```sh
export API_PERF_BASE_URL=http://127.0.0.1:3001
export API_PERF_TOKEN='<test-account-access-token>'
pnpm perf:api:baseline > /tmp/gym-api-baseline.json
```

Defaults: **2 warmups + 25 recorded requests per route**, one concurrent
request, 150 ms pause between requests, ten-second timeout per request.
Maximum recorded samples: 40 per route. To target just one route, set
`API_PERF_ROUTES=workouts-summary`; comma-separated keys are supported.
Optional `API_PERF_SAMPLES`, `API_PERF_WARMUP`, and
`API_PERF_PAUSE_MS` control repetition and pacing. Non-200 HTTP responses,
including rate-limit errors, cause the run to fail without logging response
bodies. Only HTTP loopback origins are accepted; redirects are not followed.

Record a repeatable **before** report at a fixed git SHA and dataset. Apply
an optimization separately; collect an **after** report with the same token
role, database fixture, host, API settings and sampling options. Compare
route-by-route p50/p95 latency and body-size percentiles; do not compare
numbers obtained with different fixtures or warmup/concurrency settings.

Latency includes full response-body consumption (not just time-to-first-byte).
Response bytes are **decoded** payload bytes, not compressed network bytes.
Nearest-rank p95 uses the sorted sample at `ceil(0.95 * N)`; with only
25 samples it is still a coarse tail estimate, so treat early results as
exploratory rather than a statistically stable performance SLO.
JSON output has no tokens, response bodies, arbitrary URLs or user labels.

## Remaining acceptance criteria

This collector **does not instrument Prisma query counts or SQL execution
plans**. Issue #313 remains open until a separately reviewed disposable-DB
slice records per-route query counts and `EXPLAIN (ANALYZE, BUFFERS)` plans
under fixed fixtures, and before/after real measurements are attached.
Do not enable SQL query logging on production or include bound PII values
in benchmark reports. No index/cache optimization is justified by this
harness alone.

The API's existing `/internal/metrics` histograms are service-wide and
unlabeled (intentional privacy/cardinality design); they must not be
misrepresented as these per-route timings.
